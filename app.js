const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => res.send('Hello World!'));

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));


require('dotenv').config()

const { Client, Util, DiscordAPIError } = require('discord.js')
const Discord = require('discord.js')
const ytdl = require('ytdl-core')
const YouTube = require('simple-youtube-api')
const PREFIX = ';'
const client = new Client({ intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MESSAGE_REACTIONS", "GUILD_VOICE_STATES"] })
const YTOKEN = 'AIzaSyCvLiaWbnoMyQ7RZ6VkeZOGfKkLit0eLuA'
const youtube = new YouTube(YTOKEN)

const queue = new Map()


/////////////////////


/////////////////////

client.on('ready', () => {
    console.log('Active')
    client.user.setActivity(';help', { type: "LISTENING"})
})


client.on('message', async message => {
    if(message.author.bot) return
    if(!message.content.startsWith(PREFIX)) return

    const args = message.content.substring(PREFIX.length).split(" ")
    const searchString = args.slice(1).join(' ')
    const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : ""
    const serverQueue = queue.get(message.guild.id)

    const helpembed = new Discord.MessageEmbed()
                            .setColor('#0099ff')
                            .setTitle('Woops Commands')
                            .addFields(
                                {name: ';play <TITLE|URL> | ;p <TITLE|URL>', value: 'Play a song with that address and title'},
                                {name: ';skip | ;s', value: 'Skip the currently playing song'},
                                {name: ';np', value: 'Shows the title of the currently playing song'},
                                {name: ';stop', value: 'Pause the currently playing song'},
                                {name: ';resume', value: 'Replay a paused song'},
                                {name: ';clear', value: 'Delete all requests'},
                                {name: ';queue', value: 'Show the song queue'},
                                {name: ';loop', value: 'Loop the requests'},
                                );

    if(message.content.startsWith(`${PREFIX}p`)) { //play
        const voiceChannel = message.member.voice.channel
        if(!voiceChannel) return message.channel.send("You must be on the audio channel!")
        const permissions = voiceChannel.permissionsFor(message.client.user)
        if(!permissions.has('CONNECT')) return message.channel.send("The bot does not have permission to connect to the voice channel.")
        if(!permissions.has('SPEAK')) return message.channel.send("The bot has no say in the channel.")

        if(url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playList = await youtube.getPlaylist(url)
            const videos = await playList.getVideos()
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id)
                await handleVideo(video2, message, voiceChannel, true)
            }
            message.channel.send(`Playlist **${playList.title}** has been added to the list.`)
            return undefined
        } else {
            try{
                var video = await youtube.getVideo(url)
            } catch {
                try {
                    var videos = await youtube.searchVideos(searchString, 10)
                    var index = 0
                    message.channel.send(`
__** Song Selection : **__
${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}

Choose from 1 ~ 10 songs.
                    `)
                    try {
                        var responce = await message.channel.awaitMessages(msg => msg.content > 0 && msg.content < 11, {
                            max: 1,
                            time: 30000,
                            errors: ['time']
                        })
                    } catch {
                        message.channel.send(`No or invalid song selection was provided.`)
                    }
                    const videoIndex = parseInt(responce.first().content)
                    var video = await youtube.getVideoByID(videos[videoIndex - 1].id)
                } catch {
                    return message.channel.send("No search results found.")
                }
            }
            return handleVideo(video, message, voiceChannel)
        }


    } else if (message.content.startsWith(`${PREFIX}clear`)) {
        if(!message.member.voice.channel) return message.channel.send("You must be on a voice channel to use commands.")
        if(!serverQueue) return message.channel.send("Nothing is playing.")
        serverQueue.songs = []
        serverQueue.connection.dispatcher.end()
        message.channel.send("Removed all requests.")
        return undefined
    } else if (message.content.startsWith(`${PREFIX}skip`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to skip the music.")
        if(!serverQueue) return message.channel.send("Nothing is playing.")
        serverQueue.connection.dispatcher.end()
        message.channel.send("⏭️Skipped.")
        return undefined
    } else if (message.content.startsWith(`${PREFIX}volume`)) {
        if(!message.member.voice.channel) return message.channel.send("You must be on a voice channel to use commands.")
        if(!serverQueue) return message.channel.send("Nothing is playing")
        if(!args[1]) return message.channel.send(`Volume : **${serverQueue.volume}**`)
        if(isNaN(args[1])) return message.channel.send("It is not a valid value to change the volume.")
        serverQueue.volume = args[1]
        serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5)
        message.channel.send(`Changed the volume to : **${args[1]}**`)
        return undefined
    } else if (message.content.startsWith(`${PREFIX}np`)) {
        if(!serverQueue) return message.channel.send("Nothing is playing.")
        message.channel.send(`▶️ Now Playing : **${serverQueue.songs[0].title}**`)
        return undefined
    } else if (message.content.startsWith(`${PREFIX}queue`)) {
        if(!serverQueue) return message.channel.send("Nothing is playing.")
        message.channel.send(`
        __** Playlist : **__
${serverQueue.songs.map(song => `**-** ${song.title} - Request by ${message.author.tag}`).join('\n')}

    ** Now Playing : ** ${serverQueue.songs[0].title}
        `, { split: true })
        return undefined
    } else if (message.content.startsWith(`${PREFIX}stop`)) {
        if(!message.member.voice.channel) return message.channel.send("You must be on a voice channel to use commands.")
        if(!serverQueue) return message.channel.send("Nothing is playing.")
        if(!serverQueue.playing) return message.channel.send("Already paused.")
        serverQueue.playing = false
        serverQueue.connection.dispatcher.pause()
        message.channel.send("⏸️ Paused.")
        return undefined
    } else if (message.content.startsWith(`${PREFIX}resume`)) {
        if(!message.member.voice.channel) return message.channel.send("You must be on a voice channel to use commands.")
        if(!serverQueue) return message.channel.send("Nothing is playing.")
        if(serverQueue.playing) return message.channel.send("Music is already playing.")
        serverQueue.playing = true
        serverQueue.connection.dispatcher.resume()
        message.channel.send("▶️ Resumed music.")
        return undefined
    } else if (message.content.startsWith(`${PREFIX}loop`)) {
        if(!message.member.voice.channel) return message.channel.send('You must be on a voice channel to use this command.')
        if(!serverQueue) return message.channel.send('Nothing is playing.')

        serverQueue.loop = !serverQueue.loop

        return message.channel.send(`🔁 I have now ${serverQueue.loop ? `**Enabled**` : `**Disable**`} loop.`)
    } else if (message.content.startsWith(`${PREFIX}help`)) {
        message.author.send(helpembed)
    } else if (message.content.startsWith(`${PREFIX}play`)) {
        const voiceChannel = message.member.voice.channel
        if(!voiceChannel) return message.channel.send("You must be on the audio channel!")
        const permissions = voiceChannel.permissionsFor(message.client.user)
        if(!permissions.has('CONNECT')) return message.channel.send("The bot does not have permission to connect to the voice channel.")
        if(!permissions.has('SPEAK')) return message.channel.send("The bot has no say in the channel.")

        if(url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playList = await youtube.getPlaylist(url)
            const videos = await playList.getVideos()
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id)
                await handleVideo(video2, message, voiceChannel, true)
            }
            message.channel.send(`Playlist **${playList.title}** has been added to the list.`)
            return undefined
        } else {
            try{
                var video = await youtube.getVideo(url)
            } catch {
                try {
                    var videos = await youtube.searchVideos(searchString, 10)
                    var index = 0
                    message.channel.send(`
__** Song Selection : **__
${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}

Please select one of the songs ranging from 1-10
                    `)
                    try {
                        var responce = await message.channel.awaitMessages(msg => msg.content > 0 && msg.content < 11, {
                            max: 1,
                            time: 30000,
                            errors: ['time']
                        })
                    } catch {
                        message.channel.send(`No or invalid song selection was provided.`)
                    }
                    const videoIndex = parseInt(responce.first().content)
                    var video = await youtube.getVideoByID(videos[videoIndex - 1].id)
                } catch {
                    return message.channel.send("No search results found.")
                }
            }
            return handleVideo(video, message, voiceChannel)
        }
    } else if (message.content.startsWith(`${PREFIX}s`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to skip the music.")
        if(!serverQueue) return message.channel.send("Nothing is playing.")
        serverQueue.connection.dispatcher.end()
        message.channel.send("⏭️ Skipped.")
        return undefined
    }

})

async function handleVideo(video, message, voiceChannel, playList = false) {
    const serverQueue = queue.get(message.guild.id)

    const song = {
        id: video.id,
        title: Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`
    }

    if(!serverQueue) {
        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true,
            loop: false,
        }
        queue.set(message.guild.id, queueConstruct)

        queueConstruct.songs.push(song)

        try {
            const connection = await voiceChannel.join()
            queueConstruct.connection = connection
            play(message.guild, queueConstruct.songs[0])
        } catch (error) {
            console.log(`An error occurred while connecting the voice channel. : ${error}`)
            queue.delete(message.guild.id)
            message.channel.send(`An error occurred while connecting the voice channel. : ${error}`)
        }

    } else {
        serverQueue.songs.push(song)
        if (playList) return undefined
        else return message.channel.send(`**${song.title}** has been added to this queue.`)
    }
    return undefined
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id)

    if(!song) {
        serverQueue.voiceChannel.leave()
        queue.delete(guild.id)
        return
    }

    const dispatcher = serverQueue.connection.play(ytdl(song.url, {
    quality: 'highestaudio',
    highWaterMark: 1 << 25
}))
    .on('finish', () => {
        if (!serverQueue.loop) serverQueue.songs.shift()
        play(guild, serverQueue.songs[0])
    })
    .on('error', error => {
        console.log(error)
    })
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5)

    serverQueue.textChannel.send(`▶️ Now Playing: **${song.title}**`)
}

client.login(process.env.TOKEN)
require('dotenv').config()

const { Client, Util, DiscordAPIError } = require('discord.js')
const ytdl = require('ytdl-core')
const YouTube = require('simple-youtube-api')
const PREFIX = ';'
const client = new Client({ disableEveryone: true })
const YTOKEN = 'AIzaSyBZWdBvhuVESZz9wRJSgArGNvBaAcZzIHU'
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

    if(message.content.startsWith(`${PREFIX}p`)) { //play
        const voiceChannel = message.member.voice.channel
        if(!voiceChannel) return message.channel.send("당신이 음성채널에 들어가 있어야합니다!")
        const permissions = voiceChannel.permissionsFor(message.client.user)
        if(!permissions.has('CONNECT')) return message.channel.send("음성채널에 연결할 권한이 없습니다.")
        if(!permissions.has('SPEAK')) return message.channel.send("채널에서의 발언권이 없습니다.")

        if(url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playList = await youtube.getPlaylist(url)
            const videos = await playList.getVideos()
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id)
                await handleVideo(video2, message, voiceChannel, true)
            }
            message.channel.send(`플레이리스트 **${playList.title}** 는 목록에 추가되었습니다.`)
            return undefined
        } else {
            try{
                var video = await youtube.getVideo(url)
            } catch {
                try {
                    var videos = await youtube.searchVideos(searchString, 10)
                    var index = 0
                    message.channel.send(`
__**Song Selection:**__
${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}

1 ~ 10 개의 노래 중 하나를 선택하세요.
                    `)
                    try {
                        var responce = await message.channel.awaitMessages(msg => msg.content > 0 && msg.content < 11, {
                            max: 1,
                            time: 30000,
                            errors: ['time']
                        })
                    } catch {
                        message.channel.send(`No or invalid song selection was provided`)
                    }
                    const videoIndex = parseInt(responce.first().content)
                    var video = await youtube.getVideoByID(videos[videoIndex - 1].id)
                } catch {
                    return message.channel.send("검색결과를 찾을수 없습니다.")
                }
            }
            return handleVideo(video, message, voiceChannel)
        }


    } else if (message.content.startsWith(`${PREFIX}clear`)) {
        if(!message.member.voice.channel) return message.channel.send("음악을 중지하려면 음성채널에 있어야합니다")
        if(!serverQueue) return message.channel.send("아무것도 재생되고 있지 않습니다.")
        serverQueue.songs = []
        serverQueue.connection.dispatcher.end()
        message.channel.send("재생되고 있는 음악을 멈췄습니다.")
        return undefined
    } else if (message.content.startsWith(`${PREFIX}skip`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to skip the music")
        if(!serverQueue) return message.channel.send("아무것도 재생되고 있지 않습니다.")
        serverQueue.connection.dispatcher.end()
        message.channel.send("당신을 위해 음악을 넘겼어요.")
        return undefined
    } else if (message.content.startsWith(`${PREFIX}volume`)) {
        if(!message.member.voice.channel) return message.channel.send("음악 명령을 사용하려면 음성채널에 있어야 합니다.")
        if(!serverQueue) return message.channel.send("아무것도 재생되고 있지 않습니다.")
        if(!args[1]) return message.channel.send(`볼륨: **${serverQueue.volume}**`)
        if(isNaN(args[1])) return message.channel.send("볼륨을 바꿀수있는 유효수치가 아닙니다.")
        serverQueue.volume = args[1]
        serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5)
        message.channel.send(`볼륨을 다음으로 변경하였습니다: **${args[1]}**`)
        return undefined
    } else if (message.content.startsWith(`${PREFIX}np`)) {
        if(!serverQueue) return message.channel.send("아무것도 재생되고 있지 않습니다.")
        message.channel.send(`지금 재생중: **${serverQueue.songs[0].title}**`)
        return undefined
    } else if (message.content.startsWith(`${PREFIX}queue`)) {
        if(!serverQueue) return message.channel.send("아무것도 재생되고 있지 않습니다.")
        message.channel.send(`
        __**노래 대기열:**__
${serverQueue.songs.map(song => `**-** ${song.title} - Request by ${message.author.tag}`).join('\n')}

    **재생중:** ${serverQueue.songs[0].title}
        `, { split: true })
        return undefined
    } else if (message.content.startsWith(`${PREFIX}stop`)) {
        if(!message.member.voice.channel) return message.channel.send("일시정지 명령을 사용하려면 음성채널에  있어야 합니다.")
        if(!serverQueue) return message.channel.send("아무것도 재생되고 있지 않습니다.")
        if(!serverQueue.playing) return message.channel.send("음악이 이미 일시정지 되어있습니다.")
        serverQueue.connection.dispatcher.pause()
        message.channel.send("당신을 위해 음악을 일시정지 했습니다.")
        return undefined
    } else if (message.content.startsWith(`${PREFIX}resume`)) {
        if(!message.member.voice.channel) return message.channel.send("다시 재생 명령어를 사용하려면 음성채널에 있어야 합니다.")
        if(!serverQueue) return message.channel.send("아무것도 재생되고 있지 않습니다.")
        if(serverQueue.playing) return message.channel.send("음악이 이미 재생중입니다.")
        serverQueue.playing = true
        serverQueue.connection.dispatcher.resume()
        message.channel.send("당신을 위해 음악을 다시 재생되고 있습니다.")
        return undefined
    } else if (message.content.startsWith(`${PREFIX}loop`)) {
        if(!message.member.voice.channel) return message.channel.send('이 명령어를 사용하려면 음성채널에 있어야 합니다.')
        if(!serverQueue) return message.channel.send('아무것도 재생되고 있지 않습니다.')

        serverQueue.loop = !serverQueue.loop

        return message.channel.send(`I have now ${serverQueue.loop ? `**Enabled**` : `**Disable**`} loop.`)
    } else if (message.content.startsWith(`${PREFIX}help`)) {
        message.channel.send({embed: {
            color: 3447003,
            author: {
                name: client.user.username,
                icorn_url: client.user.avatarURL
            },
            title: "Command List",
            description: ";play (;p)\n;stop\n;resume\n;skip (;s)\n;loop\n;volume\n",
            timestamp: new Date(),
            footer: {
                icorn_url: client.user.avatarURL,
                text: "ⓒ N"
            },
            //https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/first-bot/using-embeds-in-messages.md
        }
    })
    } else if (message.content.startsWith(`${PREFIX}play`)) {
        const voiceChannel = message.member.voice.channel
        if(!voiceChannel) return message.channel.send("당신이 음성채널에 들어가 있어야합니다!")
        const permissions = voiceChannel.permissionsFor(message.client.user)
        if(!permissions.has('CONNECT')) return message.channel.send("음성채널에 연결할 권한이 없습니다.")
        if(!permissions.has('SPEAK')) return message.channel.send("채널에서의 발언권이 없습니다.")

        if(url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playList = await youtube.getPlaylist(url)
            const videos = await playList.getVideos()
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id)
                await handleVideo(video2, message, voiceChannel, true)
            }
            message.channel.send(`플레이리스트 **${playList.title}** 는 목록에 추가되었습니다.`)
            return undefined
        } else {
            try{
                var video = await youtube.getVideo(url)
            } catch {
                try {
                    var videos = await youtube.searchVideos(searchString, 10)
                    var index = 0
                    message.channel.send(`
__**Song Selection:**__
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
                        message.channel.send(`No or invalid song selection was provided`)
                    }
                    const videoIndex = parseInt(responce.first().content)
                    var video = await youtube.getVideoByID(videos[videoIndex - 1].id)
                } catch {
                    return message.channel.send("검색결과를 찾을수 없습니다.")
                }
            }
            return handleVideo(video, message, voiceChannel)
        }
    } else if (message.content.startsWith(`${PREFIX}s`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to skip the music")
        if(!serverQueue) return message.channel.send("아무것도 재생되고 있지 않습니다.")
        serverQueue.connection.dispatcher.end()
        message.channel.send("당신을 위해 음악을 넘겼어요.")
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
            var connection = await voiceChannel.join()
            queueConstruct.connection = connection
            play(message.guild, queueConstruct.songs[0])
        } catch (error) {
            console.log(`음성채널 연결중 오류가 발생하였습니다: ${error}`)
            queue.delete(message.guild.id)
            message.channel.send(`음성채널 연결중 오류가 발생하였습니다: ${error}`)
        }

    } else {
        serverQueue.songs.push(song)
        if (playList) return undefined
        else return message.channel.send(`**${song.title}** 이 대기열에 추가되었습니다.`)
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

    const dispatcher = serverQueue.connection.play(ytdl(song.url))
    .on('finish', () => {
        if (!serverQueue.loop) serverQueue.songs.shift()
        play(guild, serverQueue.songs[0])
    })
    .on('error', error => {
        console.log(error)
    })
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5)

    serverQueue.textChannel.send(`재생시작: **${song.title}**`)
}

client.login(process.env.TOKEN)
require('dotenv').config();

var log4js = require('log4js');
log4js.configure({
  appenders: {
    botLogs: { type: 'file', filename: process.env.LOG_FILE },
    console: { type: 'console' }
  },
  categories: {
    bot: { appenders: ['botLogs'], level: 'info' },
    default: { appenders: ['console', 'botLogs'], level: 'trace' }
  }
});
var log = log4js.getLogger(process.env.LOG_CATEGORY);

const request = require('request');

const mongoose = require('mongoose');
mongoose.connect('mongodb://'+process.env.MONGODB_HOST+':'+process.env.MONGODB_PORT+'/'+process.env.MONGODB_NAME, {useNewUrlParser: true});
const Profile = mongoose.model('Profile', {
  username: String,
  created_at: { type: Date, default: Date.now },
  parsed_at: { type: Date, default: Date.now }
});

const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {polling: true});
const channel = process.env.TELEGRAM_CHANNEL_ID;

function parseProfile(username, chat)
{
  username = username.toLowerCase().trim();
  const url = 'https://www.instagram.com/' + username + '/';
  const short_url = 'instagram.com/username'

  Profile.findOne({ username: username }, function (err, p) {
    if (!p) {
      p = new Profile({ username: username });
      p.save().then(() => {
        log.info('Profile added @' + username);
        bot.sendMessage(chat.id, 'Profile added');
      });

      request({
        url: url + '?__a=1',
        json: true
      }, function (error, response, body) {
        if (!error && response.statusCode === 200 && response.headers['content-type'].includes('application/json')) {
          var photos = [];
          body.graphql.user.edge_owner_to_timeline_media.edges.forEach(function(edge) {
            if ('GraphImage' == edge.node.__typename || 'GraphSidecar' ==  edge.node.__typename) {
              photos.push({type: 'photo', media: edge.node.display_url});
            }
          });
          if (photos.length > 0) {
            bot.sendMessage(channel, short_url);
            bot.sendMediaGroup(channel, photos.slice(0, 9));
          }
        }
        else {
          log.error('Adding profile error:', response.statusCode, ':', error);
        }
      });
    }
    else {
      p.save().then(() => log.info('Duplicate add attempt @' + username));
    }
  });
}

// Matches "/echo [whatever]"
bot.onText(/\/echo (.+)/, (msg, match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message

  const chatId = msg.chat.id;
  const resp = match[1]; // the captured "whatever"

  // send back the matched "whatever" to the chat
  bot.sendMessage(chatId, resp);
});

bot.onText(/\/count/, (msg, match) => {
  Profile.countDocuments({}, function (err, count) {
    bot.sendMessage(msg.chat.id, 'Number of profiles: ' + count);
  });
});


// parse profile and send last pic from it
// /p @user command
// bot.onText(/\/p @(.+)/, (msg, match) => {
//   console.log('found: @' + match[1]);
//   parseProfile(match[1]);
// });

// parse profile
// insta url
bot.onText(/(https:\/\/)?(www\.)?instagram\.com\/([^\/\?]+)/, (msg, match) => {
  var added = parseProfile(match[3], msg.chat);
});


// Listen for any kind of message. There are different kinds of
// messages.
// bot.on('message', (msg) => {
//   const chatId = msg.chat.id;
//
//   // send a message to the chat acknowledging receipt of their message
//   bot.sendMessage(chatId, 'Received your message');
// });

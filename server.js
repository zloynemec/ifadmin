require('dotenv').config()

const request = require('request');
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/IFAdmin_TEST', {useNewUrlParser: true});
const Profile = mongoose.model('Profile', {
  username: String,
  created_at: { type: Date, default: Date.now },
  parsed_at: { type: Date, default: Date.now }
});

const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {polling: true});
const channel = process.env.TELEGRAM_CHANNEL_ID;

function parseProfile(username)
{
  username = username.toLowerCase().trim();
  const url = 'https://www.instagram.com/' + username + '/';

  Profile.findOne({ username: username }, function (err, p) {
    if (!p) {
      p = new Profile({ username: username });
      p.save().then(() => console.log('Added: @' + username));
    }
  });

  request({
    url: url + '?__a=1',
    json: true
  }, function (error, response, body) {
    if (!error && response.statusCode === 200 && response.headers['content-type'].includes('application/json')) {
      // console.log(body) // Print the json response
      console.log('parsed: @' + username);

      var photos = [];
      body.graphql.user.edge_owner_to_timeline_media.edges.forEach(function(edge) {
        // console.log(element);
        if ('GraphImage' == edge.node.__typename) {
          // bot.sendPhoto(msg.chat.id, edge.node.display_url);
          photos.push({type: 'photo', media: edge.node.display_url});
        }
      });
      console.log('Found ' + photos.length + ' photos');
      if (photos.length > 0) {
        bot.sendMessage(channel, url);
        bot.sendMediaGroup(channel, photos.slice(0, 9));
      }
    }
    else {
      console.log('Error occurred ' + response.statusCode + ': '  + error);
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


// parse profile and send last pic from it
// /p @user command
bot.onText(/\/p @(.+)/, (msg, match) => {
  console.log('found: @' + match[1]);
  parseProfile(match[1]);
});

// parse profile
// insta url
bot.onText(/(https:\/\/)?(www\.)?instagram\.com\/([^\/\?]+)/, (msg, match) => {
  console.log('found: @' + match[3]);
  parseProfile(match[3]);
});


// Listen for any kind of message. There are different kinds of
// messages.
// bot.on('message', (msg) => {
//   const chatId = msg.chat.id;
//
//   // send a message to the chat acknowledging receipt of their message
//   bot.sendMessage(chatId, 'Received your message');
// });

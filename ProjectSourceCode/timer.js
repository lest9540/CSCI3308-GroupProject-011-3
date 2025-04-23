const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const axios = require('axios');
const mail = require('mailgun.js');
const schedule = require('node-schedule');

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

// database configuration
const dbConfig = {
  host: process.env.POSTGRES_HOST || 'db',
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  email: process.env.POSTGRES_EMAIL,
  reminders: process.env.POSTGRES_REMINDERS,
};

const db = pgp(dbConfig);
db.connect()
  .then(obj => {
    console.log('Database connection successful');
    obj.done();
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

// initialize session variables
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
    
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

async function assembleSummaryText(name, callback) {
  try {
    return await db.any('SELECT * FROM transactions WHERE user_id = $1', [name])
    .then(results => {
      var recent_text = "Here are all transactions so far this month:\n"; // assemble list of recent transactions
      var upcoming_text = "Here are all upcoming transactions this month:\n"; // assemble list of upcoming transactions
      var cur_date = new Date();
      var cur_day = cur_date.getDate();
      var cur_month = cur_date.getMonth() + 1; // Months are zero-based
      var temp_month = undefined;
      var temp_day = undefined;
      // ignoring the year for scope of project

      for (let i = 0; i < results.length; i++) { // find all transactions this month
        temp_month = results[i].transaction_date.getMonth() + 1;
        temp_day = results[i].transaction_date.getDate();

        if ((cur_month != temp_month) || (temp_day > cur_day)) continue; // only summarizing this month up to today
        
        recent_text += results[i].name + " - " + results[i].transaction_date.toLocaleDateString() + " - $" + results[i].amount + "\n";
      }

      for (let i = 0; i < results.length; i++) { // find all upcoming transactions this month
        temp_month = results[i].transaction_date.getMonth() + 1;
        temp_day = results[i].transaction_date.getDate();

        if ((cur_month != temp_month) || (temp_day <= cur_day)) continue; // only summarizing this month after today
        
        upcoming_text += results[i].name + " - " + results[i].transaction_date.toLocaleDateString() + " - $" + results[i].amount + "\n";
      }

      callback("Greetings " + name + ",\n\nBecause you have opted into regular updates we have provided you the following summary for this month so far:\n\n" + recent_text + "\n" + upcoming_text + "\n Thank you for using SpellSaver!");
    })
    .catch(error => {
      console.log(error);
      return undefined;
    });
  }
  catch(error) {
    console.log(error);
    return undefined;
  };
};

async function sendSummary(name, email, summary_text) {
  const mailgun = new mail(FormData);
  const mg = mailgun.client({
    username: "api",
    key: process.env.API_KEY || "API_KEY",
  });
  try {
    const data = await mg.messages.create("sandboxa2db92420e4b4b1b985d93f3f2e6d247.mailgun.org", {
      from: "SpellSaver <lest9540@colorado.edu>",
      to: [name + " <" + email + ">"],
      subject: "Thank You for Optin In",
      text: summary_text,
    });

    console.log(data);
  }
  catch (error){
    console.log(error);
  }
};

async function summary() {
  console.log("summary function called");
  try {
    await db.any('SELECT * FROM users WHERE reminders = true')
      .then(results => {
        for (let i = 0; i < results.length; i++) {
          assembleSummaryText(results[i].username, text => {
            sendSummary(results[i].username, results[i].email, text);
          })
        }
        console.log("Summary function complete");
      })
      .catch(error => {
        console.log(error);
      })
  }
  catch (error) {
    console.log(error);
  }
}

const rule = new schedule.RecurrenceRule();
  console.log("Scheduling timer");
  rule.hour = 12;

  const job = schedule.scheduleJob(rule, function(){
    console.log("Running summary function");
    summary();
  });
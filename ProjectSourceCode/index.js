const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const nodemailer = require('nodemailer');
const mail = require('mailgun.js');
const schedule = require('node-schedule');
const wt = require("worker-thread");

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

// database configuration
const dbConfig = {
  host: 'db',
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

// Authentication Middleware.
const auth = (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    next();
};

// API Funcs //
async function sendOptInMessage(name, email) {
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
      text: "Congratulations " + name + ",\n\n       You have succesfully opted into regular updates about your budget with SpellSaver.\n       We will be sending you regular updates about your budget.\n\n Thank you for using SpellSaver!",
    });

    console.log(data); // logs response data
  } catch (error) {
    console.log(error); //logs any error
  }
}

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
      })
      .catch(error => {
        console.log(error);
      })
  }
  catch (error) {
    console.log(error);
  }
}

app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

app.get('/login', (req, res) => {
    res.render('pages/login.hbs')
});

//---------------------------------------------------------------------------------------------
//front_page branch

// .get for the front page
app.get('/front', (req, res) => {
  res.render('pages/front');
});

//---------------------------------------------------------------------------------------------

app.post("/login", async (req, res) => {
    try {db.any('SELECT * FROM users WHERE username = $1', [req.body.username]) 
        .then( async user => { 
            if (!user.length) { // no user found
              res.render('pages/login.hbs', {redirect: true});
            }
            else {
                const match = await bcrypt.compare(req.body.password, user[0].password);
            if (match) { // found user and password
                req.session.user = user;
                req.session.save();
                res.redirect('/user');
            }
            else { // found user wrong password
                res.render('pages/login.hbs')
            }
        }
    })} 
    catch { console.log("manual error"); };
});

app.get('/register', (req, res) => {
    res.render('pages/register')
});

app.post('/register', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  db.none('INSERT INTO users(username, password, email) VALUES($1, $2, $3)', [req.body.name, hash, req.body.email])
    .then(() => {
      res.redirect('/login');
    })
    .catch(error => {
      console.log(error);
      res.redirect('/register');
    });
});

app.get('/', (req, res) => {
    res.redirect('/login');
});

// Authentication Required past here
app.use(auth);

app.get('/user', async (req, res) => {
  var flag = req.session.user[0].reminders;
  if (flag == undefined) { // default off value is technically undefined
    flag = false;
  }
  res.render('pages/user', {username: req.session.user[0].username, email: req.session.user[0].email, OptIn: flag});
});

app.get('/settings', (req, res) => {
  res.render('pages/settings', {OptIn: req.session.user[0].reminders});
});

app.post('/settings', async (req, res) => {
  var flag = req.body.EmailOptIn;
  if (flag == undefined) { // default off value is technically undefined
    flag = false;
  }
  else if (flag == 'on') {
    flag = true;
  }

  db.any('UPDATE users SET reminders = $1 WHERE username = $2', [flag, req.session.user[0].username])
    .then(() => {
      if (flag) {
        sendOptInMessage(req.session.user[0].username, req.session.user[0].email);
      }
      req.session.user[0].reminders = flag;
      res.render('pages/user', {name: req.session.user[0].user, email: req.session.user[0].email, OptIn: flag});
    })
    .catch(error => {
      console.log(error);
      res.render('pages/user', {name: req.session.user[0].user, email: req.session.user[0].email, OptIn: flag});
    });
  });

app.get('/banking', async (req, res) => {
    try{
      let results = await db.any('SELECT * FROM transactions WHERE user_id = $1', [req.session.user[0].username]);
      res.render('pages/banking', {transactions: results});
      // console.log(results);
    } catch (error) {
      console.log(error);
      res.render('pages/banking', {transactions: []});
    }
});

app.post('/addTransaction', (req, res) => {
  const date = new Date(req.body.transactionDate);
  const formattedDate = date.toISOString().split('T')[0]; // Format date to YYYY-MM-DD
  req.body.transactionDate = formattedDate;
  console.log(req.body);
  db.none('INSERT INTO transactions(user_id, name, category, transaction_date, amount, final_balance) VALUES($1, $2, $3, $4, $5, $6)', [req.session.user[0].username, req.body.transactionName, req.body.category, req.body.transactionDate, req.body.transactionAmount, req.body.finalBalance]);
  res.redirect('/banking');
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.render('pages/logout.hbs');
});

module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
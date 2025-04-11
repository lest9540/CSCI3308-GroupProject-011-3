// import FormData from "form-data"; // form-data v4.0.1
// import Mailgun from "mailgun.js"; // mailgun.js v11.1.0

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
  // sendSimpleMessage();
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
                res.redirect('/settings');
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

// app.get('/discover', (req, res) => {
//     axios({
//         url: `https://app.ticketmaster.com/discovery/v2/events.json`,
//         method: 'GET',
//         dataType: 'json',
//         headers: { 'Accept-Encoding': 'application/json'},
//         params: {
//             apikey: process.env.API_KEY,
//             keyword: 'Muse',
//             size: 10
//         }
//     })
//     .then(results => { 
//         // the results will be displayed on the terminal if the docker containers are running 
//         res.render('pages/discover', {event: results.data._embedded.events});
//         // Send some parameters
//     })
//     .catch(error => { 
//         console.log(error);
//         res.render(400, 'pages/discover', {event: []});
//     });
// });

app.get('/banking', async (req, res) => {
    try{
      let results = await db.any('SELECT * FROM transactions WHERE user_id = $1', [req.session.user[0].username]);
      res.render('pages/banking', {transactions: results});
    } catch (error) {
      console.log(error);
      res.render('pages/banking', {transactions: []});
    }
});

app.post('/addTransaction', (req, res) => {
  db.none('INSERT INTO transactions(user_id, name, transaction_date, amount, final_balance) VALUES($1, $2, $3, $4, $5)', [req.session.user[0].username, req.body.transactionName, req.body.transactionDate, req.body.transactionAmount, req.body.finalBalance]);
  res.redirect('/banking');
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.render('pages/logout.hbs');
});

module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
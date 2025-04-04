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

// API Routes //

app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

app.get('/login', (req, res) => {
    res.render('pages/login.hbs')
});

app.post("/login", async (req, res) => {
    try {db.any('SELECT * FROM users WHERE username = $1', [req.body.username]) 
        .then( async user => { 
            if (!user.length) { // no user found
                res.redirect('/register');
            }
            else {
                const match = await bcrypt.compare(req.body.password, user[0].password);
            if (match) { // found user and password
                req.session.user = user;
                req.session.save();
                res.redirect('/discover');
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
    //hash the password using bcrypt library
    const hash = await bcrypt.hash(req.body.password, 10);
    
    // To-DO: Insert username and hashed password into the 'users' table
    db.none('INSERT INTO users(username, password) VALUES($1, $2)', [req.body.username, hash])
      .then(() => {
        res.redirect('/login');
      })
      .catch(error => {
        console.log(error);
        res.redirect(400, '/register');
      });
});

// Authentication Required past here
app.use(auth);

app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/user', (req, res) => {
  res.render('pages/user')
});

app.get('/discover', (req, res) => {
    axios({
        url: `https://app.ticketmaster.com/discovery/v2/events.json`,
        method: 'GET',
        dataType: 'json',
        headers: { 'Accept-Encoding': 'application/json'},
        params: {
            apikey: process.env.API_KEY,
            keyword: 'Muse',
            size: 10
        }
    })
    .then(results => { 
        // the results will be displayed on the terminal if the docker containers are running 
        res.render('pages/discover', {event: results.data._embedded.events});
        // Send some parameters
    })
    .catch(error => { 
        console.log(error);
        res.render(400, 'pages/discover', {event: []});
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.render('pages/logout.hbs');
});

module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
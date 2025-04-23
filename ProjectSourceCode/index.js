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
const mail = require('mailgun.js');
const { error } = require('console');

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

// database configuration
const dbConfig = {
  host: process.env.POSTRGRES_HOST || 'db',
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

// .get for the front page
app.get('/front', (req, res) => {
  res.render('pages/front');
});

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
      console.log(results);
      res.render('pages/banking', {transactions: results});
    } catch (error) {
      console.log(error);
      res.render('pages/banking', {transactions: []});
    }
});

app.post('/addTransaction', (req, res) => {
  const date = new Date(req.body.transactionDate); // Format date to YYYY-MM-DD
  const formattedDate = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  }
  console.log(formattedDate);
  db.none('INSERT INTO transactions(user_id, name, category, month, day, year, amount, final_balance) VALUES($1, $2, $3, $4, $5, $6, $7, $8)', [req.session.user[0].username, req.body.transactionName, req.body.category, formattedDate.month, formattedDate.day, formattedDate.year, req.body.transactionAmount, req.body.finalBalance]);
  res.redirect('/banking');
});

// Post to send planner piechart data to the database
app.post('/postPlannerPieChartData', async (req, res) => {

  // Grabbing the input data from the html and getting the logged in user's username
  const {recurring_percentage, groceries_percentage, personal_percentage, miscellaneous_percentage} = req.body;
  const userId = req.session.user[0].username

  // Insert into the database table, returns success/error
  try{
    await db.none(
      `INSERT INTO plannerPiechartData(user_id, recurring_percentage, groceries_percentage, personal_percentage, miscellaneous_percentage)
      VALUES($1, $2, $3, $4, $5)
      ON CONFLICT (user_id)
      DO UPDATE SET recurring_percentage = $2, groceries_percentage = $3, personal_percentage = $4, miscellaneous_percentage = $5`,
      [userId, recurring_percentage, groceries_percentage, personal_percentage, miscellaneous_percentage]
    );
    res.json({message: "Planner pie chart data saved successfully"});

  } catch (error) {
    console.error("Error saving the planner pie chart data", error);
  }
});

// Gets data from planner piechart database table and returns query
app.get('/loadPlannerPieChartData', async (req, res) => {

  // Takes logged in user's username
  const userId = req.session.user[0].username; 
  
  // Query to find username in the plannerPiechartData table to return the stored data
  try {
    const piePlannerChartData = await db.oneOrNone('SELECT * FROM plannerPiechartData WHERE user_id = $1', [userId]);
    
    if (piePlannerChartData) {
      res.json(piePlannerChartData);
    } else {
      res.json({
        recurring_percentage: 0,
        groceries_percentage: 0,
        personal_percentage: 0,
        miscellaneous_percentage: 0
      });
    }
  } catch (error) {
    console.error('Error loading pie chart data:', error);
  }
});

// Grabs transaction history data, calculates percentages and returns list of percentages
app.get('/loadPieChartTransaction', async (req, res) => {
  const userId = req.session.user[0].username; 
  
  // Query to grab transactions by user
  try {
    const userTransactions = await db.any(
      `SELECT *
      FROM transactions
      WHERE user_id = $1`,
      [userId]
    );

    let total = 0;
    let recurringTotal = 0;
    let groceriesTotal = 0;
    let personalTotal = 0;
    let miscTotal = 0;

    // Loop that goes through each transaction and adds money to each total
    userTransactions.forEach(transaction => {
      const amountTemp = parseFloat(transaction.amount);
      total += amountTemp;

      switch(transaction.category) {
        case 'Recurring Expense':
            recurringTotal += amountTemp;
          break;
        case 'Groceries':
            groceriesTotal += amountTemp;
          break;
        case 'Personal Spending':
            personalTotal += amountTemp;
          break;
        case 'Miscellaneous':
            miscTotal += amountTemp;
          break;
        default:
          break;
      }
    });

    // Calculating percentages for each category
    const recurringPercentage = (recurringTotal / total) * 100;
    const groceriesPercentage = (groceriesTotal / total) * 100;
    const personalPercentage = (personalTotal / total) * 100;
    const miscPercentage = (miscTotal / total) * 100;

    // Checks to see if the total is positive, if not returns 0
    if (total > 0){
      return res.json({
        recurring_percentage: Number(recurringPercentage.toFixed(1)),
        groceries_percentage: Number(groceriesPercentage.toFixed(1)),
        personal_percentage: Number(personalPercentage.toFixed(1)),
        miscellaneous_percentage: Number(miscPercentage.toFixed(1))
      });
    } else {
      return res.json({
        recurring_percentage: 0,
        groceries_percentage: 0,
        personal_percentage: 0,
        miscellaneous_percentage: 0
      });
    }

  } catch (error) {
    console.error('Error loading pie chart data from transaction history:', error);
    return res.status(500).json({ error: 'Error loading transactions'})
  }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.render('pages/logout.hbs', {redirect: true});
});

// For Calendar Partial - - - - - - - - - - - - 
app.get('/api/transactions', async (req, res) => { // use api because it is used for data exchange and the calendar needs to extract the data of the transactions
  // Also use api because if using another way then the calendar wouldn't update when the user made changes -> user would have to reload to see the changes
  const date = req.query.date;
  const user = req.session.user?.[0]?.username; // Read it from left to right -> ? checks if there is a user before access the array with transactions

  if (!date || !user) 
    {
      return res.status(400).json({ error: 'Missing date or user' });
    }

  try {
    const transactions = await db.any(
      'SELECT name, amount, final_balance FROM transactions WHERE user_id = $1 AND transaction_date = $2',
      [user, date]
    );
    return res.json(transactions);

    } catch (error) 
      {
        console.error('Error getting transactions for calendar:', error);
        return res.status(500).json({ error: 'Server Error' });
      }
});

// Updates the indicators on the calendar dates (updates the lines to show that there is a transaction due on this date)  
app.get('/api/transaction-dates', async (req, res) => { // Like said before needs api because we want the calendar to dynamically update with new transactions (don't want user to have to reload the page)
  const { month, year } = req.query;
  const user = req.session.user?.[0]?.username;

  if (!month || !year || !user) {
    return res.status(400).json({ error: 'Missing month, year, or user' });
  }

  try {
    const results = await db.any(
      `SELECT DISTINCT transaction_date::DATE AS date
        FROM transactions
      WHERE user_id = $1
        AND EXTRACT(MONTH FROM transaction_date::DATE) = $2
        AND EXTRACT(YEAR FROM transaction_date::DATE) = $3`,
      [user, month, year]
    );

    const formatted = results.map(row => row.date.toISOString().split('T')[0]);
    return res.json(formatted);

  } catch (error) {
    console.error('Error getting transaction dates:', error);
    return res.status(500).json({ error: 'Server Error' });
  }
});
// - - - - - - - - - - - - - - - - - - - - - - -

module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
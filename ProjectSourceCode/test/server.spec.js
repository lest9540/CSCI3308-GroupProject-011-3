// ********************** Initialize server **********************************

const server = require('../index'); //TODO: Make sure the path to your index.js is correctly added

// ********************** Import Libraries ***********************************

const chai = require('chai'); // Chai HTTP provides an interface for live integration testing of the API's.
const chaiHttp = require('chai-http');
const { restart } = require('nodemon');
chai.should();
chai.use(chaiHttp);
const {assert, expect} = chai;

// ********************** DEFAULT WELCOME TESTCASE ****************************

describe('Server!', () => {
  // Sample test case given to test / endpoint.
  it('Returns the default welcome message', done => {
    chai
      .request(server)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('success');
        assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });
});

// *********************** TODO: WRITE 2 UNIT TESTCASES **************************

// ********************************************************************************

const html_start_regex = /^<!DOCTYPE html>.*/;
const html_end_regex = /.*<\/html>$/;

const register_regex = /.*<form action=.* method=.*>.*/

// Test cases for /register API, positive and negative
describe('Testing Register User API', () => {
    it('positive : /register', done => {
      chai
        .request(server)
        .post('/register')
        .send({username: 'John Doe', password: 'scoobydoo'})
        .end((err, res) => {
          expect(res).to.have.status(200);
          check = (html_start_regex.test(res.text) && html_end_regex.test(res.text) && register_regex.test(res.text))
          assert(check == true);
          done();
        });
    });

    it('Negative : /register. Checking invalid name', done => {
      chai
        .request(server)
        .post('/register')
        .send({username: undefined, password: 'scoobydoo'})
        .end((err, res) => {
          expect(res).to.have.status(400);
          console.log("\nres.text:\n" + res.text + "\n");
          done();
        });
    });
  });


  
// ***************** TODO: 2 Test cases for Redirect/Render ***********************

// ********************************************************************************

// // Testing for Redirect
// describe('Testing Redirect', () => {
//   // Sample test case given to test /test endpoint.
//   it('\test route should redirect to /login with 302 HTTP status code', done => {
//     chai
//       .request(server)
//       .get('/test')
//       .end((err, res) => {
//         res.should.have.status(302); // Expecting a redirect status code
//         res.should.redirectTo(/^.*127\.0\.0\.1.*\/login$/); // Expecting a redirect to /login with the mentioned Regex
//         done();
//       });
//   });
// });


// Testing for Render
describe('Testing Render', () => {
  // Sample test case given to test /test endpoint.
  it('test "/login" route should render with an html response', done => {
    chai
      .request(server)
      .get('/login') // for reference, see lab 8's login route (/login) which renders home.hbs
      .end((err, res) => {
        res.should.have.status(200); // Expecting a success status code
        res.should.be.html; // Expecting a HTML response
        done();
      });
  });
});
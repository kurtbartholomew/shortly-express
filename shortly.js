var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var bcrypt = require('bcrypt');
var GitHubStrategy = require('passport-github').Strategy;
var passport = require('passport');

var githubAuth = require('./lib/githubSecrets');
var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();


app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({
  secret: 'nyan cat',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GitHubStrategy({
    clientID: githubAuth.CLIENT_ID,
    clientSecret: githubAuth.CLIENT_SECRET,
    callbackURL: "http://127.0.0.1:4568/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {

      // To keep the example simple, the user's GitHub profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the GitHub account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));

app.get('/auth/github', passport.authenticate('github'), function(req,res){

});

app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }),
function(req, res) {
  res.redirect('/');
});

app.get('/', util.checkSession, function(req, res) {
  res.render('index');
});

app.get('/create',util.checkSession, function(req, res) {
  res.render('index');
});

app.get('/links', util.checkSession, function(req, res) {
  // user is logged in from github already, this won't work
  Users.query('where', 'username', '=', req.session.user).fetchOne().then(function(instance){
    Links.reset().query('where', 'user_id', '=', instance.attributes.id ).fetch().then(function(links) {
      res.send(200, links.models);
    });
  });
});


app.get('/login', function(req,res){
  res.render('login');
});

app.get('/signup', function(req,res){
  res.render('signup');
});

app.post('/links', util.checkSession, function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        // need to change this since we will be using github's login
        Users.query('where', 'username', '=', req.session.user).fetchOne().then(function(instance){

          var link = new Link({
            user_id: instance.attributes.id,
            url: uri,
            title: title,
            base_url: req.headers.origin
          });

          link.save().then(function(newLink) {
            Links.add(newLink);
            res.send(200, newLink);
          });

        });

      });
    }
  });
});


/************************************************************/
// Write your authentication routes here
/************************************************************/

app.post('/signup',function(req,res){
  res.redirect('/auth/github');
  // var user = req.body.username;
  // var pass = req.body.password;

  // new User({ username: user }).fetch().then(function(found){
  //   if (found) {
  //     res.send(302, "Username already exists");
  //   } else {

  //     bcrypt.genSalt(10, function(err, salt){
  //       bcrypt.hash(pass, salt, function(err, hash){

  //         //get it?
  //         var newser = new User({
  //           username: user,
  //           password: hash,
  //           salt: salt
  //         });

  //         newser.save().then(function(newUser){
  //           Users.add(newUser);
  //           req.session.user = user;
  //           res.redirect('/');
  //         });
  //       });
  //     });


  //   }
  // });
});

app.post('/login',function(req,res){
  res.redirect('/auth/github');
  // var username = req.body.username;
  // var password = req.body.password;

  // Users.query('where', 'username', '=', username).fetchOne().then(function(instance){

  //   if(instance){

  //     var userAttr = instance.attributes;

  //     bcrypt.hash(password, userAttr.salt, function(err, hashToCompare){

  //       if(hashToCompare === userAttr.password){
  //         req.session.regenerate(function(){
  //           req.session.user = username;
  //           req.session.save();
  //           return res.redirect('/');
  //         });
  //       }
  //       else{
  //         res.redirect('login');
  //       }
  //     });

  //   }
  //   else{
  //     res.redirect('/login');
  //   }

  // });

});


app.get('/logout', function(req,res){

  req.session.destroy(function(){
    res.redirect('/login');
  });
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);

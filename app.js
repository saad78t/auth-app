const express = require('express');
const app = express();
const path = require('path');
const bodyparser = require('body-parser');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const flash = require('connect-flash');
const session = require('express-session');
const userRoutes = require('./routes/users');
const passport = require('passport');
const localStrategy = require('passport-local').Strategy;
const User = require('./models/usermodel');

dotenv.config({ path: '.env' });

//to connext the databast to mongodb
mongoose.connect(process.env.DATABASE_LOCAL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

//middleware for session
app.use(
  session({
    secret: 'just a simple login/signup application',
    resave: true,
    saveUninitialized: true,
  })
);

//using passport middleware
app.use(passport.initialize());
app.use(passport.session());
/**
 * in case we did not write { usernameField: 'email' } in
 * localStrategy and in the plugin of userSchema we will fwt the error below:
 * ERROR: MissingUsernameError: No username was given
 */
passport.use(new localStrategy({ usernameField: 'email' }, User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//middleware for flash messages
app.use(flash());

//setting middleware globally
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.currentUser = req.user;
  next();
});

app.use(userRoutes);
app.use(bodyparser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.listen(process.env.PORT, () => {
  console.log('Server is started 😍');
});

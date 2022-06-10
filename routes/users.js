const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/usermodel');
const bodyparser = require('body-parser');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const async = require('async');
router.use(bodyparser.urlencoded({ extended: true }));

//check is the user authenticated
function isAuthenticatedUser(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error_msg', 'Please Login first to access this page.');
  res.redirect('/login');
}

router.get('/login', (req, res) => {
  res.render('login');
});

router.get('/signup', (req, res) => {
  res.render('signup');
});

router.get('/password/change', isAuthenticatedUser, (req, res) => {
  res.render('changepassword');
});

router.get('/dashboard', isAuthenticatedUser, (req, res) => {
  res.render('dashboard');
});

router.get('/logout', isAuthenticatedUser, (req, res) => {
  req.logOut((err) => {
    if (err) {
      req.flash('error', 'Something went wrong 💥');
    }
    req.flash('success_msg', 'You have been logged out successfully 😍');
    res.redirect('/login');
  });
});

router.get('/forgot', (req, res) => {
  res.render('forgot');
});

//to get reset password page
router.get('/reset/:token', (req, res) => {
  User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() },
  })
    .then((user) => {
      if (!user) {
        req.flash('error_msg', '💥💥Password reset token is invalid or expired💥💥');
        return res.redirect('/forgot');
      }
      res.render('newpassword', { token: req.params.token });
    })
    .catch((err) => {
      req.flash('error_msg', 'ERROR: ' + err);
      // res.redirect('/forgot');
    });
});

//to update password
router.post('/reset/:token', (req, res) => {
  async.waterfall(
    [
      (done) => {
        User.findOne({
          resetPasswordToken: req.params.token,
          resetPasswordExpires: { $gt: Date.now() },
        })
          .then((user) => {
            if (!user) {
              req.flash('error_msg', 'Password reset token is invalid or expired');
              res.redirect('/forgot');
            }
            if (req.body.password !== req.body.confirmpassword) {
              req.flash('error', '💥💥💥PASSWORDS DONT MATCH 💥💥💥');
              return res.redirect('/forgot');
            }

            user.setPassword(req.body.password, (err) => {
              resetPasswordToken = undefined;
              resetPasswordExpire = undefined;

              user.save((err) => {
                req.logIn(user, (err) => {
                  done(err, user);
                });
              });
            });
          })
          .catch((err) => {
            req.flash('error_msg', 'ERROR: ' + err);
            // res.redirect('/forgot');
          });
      },
      (user) => {
        let smtpTransport = nodemailer.createTransport({
          service: 'Gmail',
          auth: {
            user: process.env.GMAIL_EMAIL,
            pass: process.env.GMAIL_PASSWORD,
          },
        });
        let mailOptions = {
          to: user.email,
          from: 'Saad Turky saad@gmail.com',
          subject: 'Your password is changed',
          text:
            'Hello, ' +
            user.name +
            '\n\n' +
            'This is the confirmation that the password for your account ' +
            user.email +
            ' has been changed.',
        };

        smtpTransport.sendMail(mailOptions, (err) => {
          req.flash('success_msg', 'Your password has been changed successfully.');
          res.redirect('/login');
        });
      },
    ],
    (err) => {
      res.redirect('/login');
    }
  );
});

router.post(
  '/login',

  passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureFlash: 'Invalid email or password. Try again',
  }),
  (req, res) => {}
);

router.post('/signup', (req, res) => {
  const { name, email, password } = req.body;

  /**
   * we did not write the password here because.
   * we want to hash the password using passport.
   */
  const userData = {
    name: name,
    email: email,
  };

  User.register(userData, password, (err, user) => {
    if (err) {
      req.flash('error_msg', 'ERROR: ' + err);
      res.redirect('/signup');
    }
    passport.authenticate('local')(req, res, () => {
      req.flash('success_msg', 'Account created successfully😍');
      res.redirect('/login');
    });
  });
});

//Router to handle forgot password
router.post('/forgot', (req, res, next) => {
  let recoveryPassword = '';
  //waterfall is to run array of functions one after another
  async.waterfall(
    [
      (done) => {
        crypto.randomBytes(30, (err, buf) => {
          let token = buf.toString('hex');
          done(err, token);
        });
      },
      (token, done) => {
        User.findOne({ email: req.body.email })
          .then((user) => {
            if (!user) {
              req.flash('error_msg', 'User does not exist with this email');
              return res.redirect('/forgot');
            }

            user.resetPasswordToken = token;
            user.resetPasswordExpires = Date.now() + 1800000; // 1/2 hour
            user.save((err) => {
              done(err, token, user);
            });
          })
          .catch((err) => {
            req.flash('error_msg', 'ERROR: ' + err);
            res.redirect('/forgot');
          });
      },
      (token, user) => {
        //SMTP is a simple mail transfer protocol
        let smtpTransport = nodemailer.createTransport({
          host: 'smtp.mailtrap.io',
          port: 2525,
          auth: {
            user: process.env.GMAIL_EMAIL,
            pass: process.env.GMAIL_PASSWORD,
          },
        });

        let mailOptions = {
          to: user.email,
          from: 'Saad Turky saad@gmail.com',
          subject: 'Recovery email from auth project',
          text:
            'Please click the following link to recover the password: \n\n' +
            'http://' +
            req.headers.host +
            '/reset/' +
            token +
            '\n\n' +
            'If you did not request this email please ignore it.',
        };
        smtpTransport.sendMail(mailOptions, (err) => {
          req.flash('success_msg', 'Email send with further informations, please check that');
          res.redirect('/forgot');
        });
      },
    ],
    (err) => {
      if (err) res.redirect('/forgot');
    }
  );
});

//to change password
router.post('/password/change', (req, res) => {
  if (req.body.password !== req.body.confirmpassword) {
    req.flash('error_msg', 'Passwords dont match');
    return res.redirect('/password/change');
  }
  User.findOne({ email: req.user.email }).then((user) => {
    user.setPassword(req.body.password, (err) => {
      user
        .save()
        .then((user) => {
          req.flash('success_msg', 'Password changed successfully.');
          res.redirect('/dashboard');
        })
        .catch((err) => {
          req.flash('error_msg', 'ERROR: ' + err);
          res.redirect('/password/change');
        });
    });
  });
});

module.exports = router;

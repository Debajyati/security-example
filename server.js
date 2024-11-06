const path = require("path");
const fs = require("fs");
const https = require("https");
const express = require("express");
const helmet = require("helmet");
const passport = require("passport");
const cookieSession = require("cookie-session");
const { Strategy } = require("passport-google-oauth20");

require("dotenv").config();

const PORT = 3000;
const config = {
  CLIENT_ID: process.env.CLIENT_ID,
  CLIENT_SECRET: process.env.CLIENT_SECRET,
  COOKIE_KEY_1: process.env.COOKIE_KEY_1,
  COOKIE_KEY_2: process.env.COOKIE_KEY_2,
};

const AUTH_OPTIONS = {
  callbackURL: "/auth/google/callback",
  clientID: config.CLIENT_ID,
  clientSecret: config.CLIENT_SECRET,
};

function verifyCallback(accessToken, refreshToken, profile, done) {
  console.log("Google Profile", profile);
  done(null, profile);
}

passport.use(new Strategy(AUTH_OPTIONS, verifyCallback));

// save the session to the cookie
passport.serializeUser((user, done)=> {
  done(null, user.id);
});

// Read the session from the cookie
passport.deserializeUser((id, done)=> {
  /* User.findById(id).then(user => {
    done(null, user);
  }) */
  done(null, id);
})

const app = express();

app.use(helmet());
app.use(
  cookieSession({
    name: "session",
    maxAge: 24 * 60 * 60 * 1000,
    keys: [config.COOKIE_KEY_1, config.COOKIE_KEY_2],
  }),
);
// register regenerate & save after the cookieSession middleware initialization
app.use(function (request, response, next) {
  if (request.session && !request.session.regenerate) {
    request.session.regenerate = (callback) => {
      callback();
    };
  }
  if (request.session && !request.session.save) {
    request.session.save = (callback) => {
      callback();
    };
  }
  next();
});
app.use(passport.initialize());
app.use(passport.session());

function checkLoggedIn(req, res, next) {
  console.log(`Current user is ${req.user}`);
  const loggedIn = req.isAuthenticated() && req.user;
  if (!loggedIn) {
    return res.status(401).json({
      error: "You Must Log In!",
    });
  }
  next();
}

app.get("/auth/google", passport.authenticate("google", { scope: ["email"] }));

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/failure",
    successRedirect: "/",
    session: true,
  }),
  (req, res) => {
    console.log("Google called us back!!");
  },
);

app.get("/failure", (req, res) => {
  return res.send("Failed to log in!");
});

app.get("/auth/logout", async (req, res, next) => {
  req.logout(err => {
    if (err) {
      return next(err);
    }
    res.redirect('/');
  }); // removes req.user and clears any logged in session 
});

app.get("/secret", checkLoggedIn, (req, res) => {
  return res.send("Your Personal Secret value is 42!");
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

https
  .createServer(
    {
      key: fs.readFileSync("key.pem"),
      cert: fs.readFileSync("cert.pem"),
    },
    app,
  )
  .listen(PORT, () => {
    console.log(`Listening on port ${PORT}...`);
  });

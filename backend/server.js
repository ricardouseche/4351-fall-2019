const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const env = process.env.NODE_ENV || 'databaseConfig';
const config = require('./config')[env];
const passport = require('passport');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const LocalStrategy = require('passport-local').Strategy;
const jwt = require('jsonwebtoken');
const passportJWT = require('passport-jwt');
const JwtStrategy = passportJWT.Strategy;
const ExtractJwt = passportJWT.ExtractJwt;

const app = express();

const connection = mysql.createConnection({
  ...config
});

connection.connect(err => {
  if (err) {
    console.log(err);
    return err;
  } else {
    console.log('Successfully connected to the database');
  }
});

app.use(cors());

//
// **** PASSPORT SETUP ****
//

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// the secret would normally be put into a config file
app.use(
  session({
    secret: 'harambe',
    resave: true,
    saveUninitialized: true
  })
);
app.use(passport.initialize());
app.use(passport.session());

// store user in the session
passport.serializeUser((user, done) => {
  done(null, user);
});

//retrieve user from the session
passport.deserializeUser((user, done) => {
  done(null, user);
});

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: 'somesecretkey'
};
passport.use(
  new JwtStrategy(opts, (payload, next) => {
    const command = `SELECT * FROM person WHERE person.id = '${payload.user.id}'`;
    connection.query(command, (err, result) => {
      if (err) {
        console.log(err);
      } else {
        if (result.length > 0) {
          next(null, result[0]);
        }
      }
    });
  })
);

passport.use(
  new LocalStrategy(
    {
      usernameField: 'username',
      passwordField: 'password'
    },
    (username, password, done) => {
      const command = `SELECT 
      person.id,
      person.firstName,
      person.lastName,
      person.roleID,
      person.userName,
      person.password,
      roleName.roleName
    FROM
      person,
      roleName
    WHERE
      person.roleID = roleName.id
          AND userName = '${username}'
          AND password = '${password}'`;
      connection.query(command, (err, result) => {
        if (err) {
          console.log(err);
        } else {
          if (result.length > 0 && result[0].password == password) {
            let user = {};
            user['username'] = result[0].userName;
            user['password'] = result[0].password;
            user['id'] = result[0].id;
            user['firstName'] = result[0].firstName;
            user['lastName'] = result[0].lastName;
            user['roleID'] = result[0].roleID;
            user['roleName'] = result[0].roleName;
            done(null, user);
          } else {
            done(null, false);
          }
        }
      });
    }
  )
);

app.post(
  '/auth/signin',
  passport.authenticate('local', {
    failureRedirect: '/'
  }),
  (req, res) => {
    jwt.sign(
      {
        user: {
          username: req.user.username,
          password: req.user.password,
          id: req.user.id
        }
      },
      'somesecretkey',
      (err, token) => {
        return res.json({
          result: req.user,
          token
        });
      }
    );
  }
);

app.get(
  '/getUser',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    return res.json(req.user);
  }
);

//
// **** PASSPORT END ****
//

app.get('/', (req, res) => {
  res.json('Default route');
});

app.post('/roleLinks', (req, res) => {
  const { roleID } = req.body;
  const command = `SELECT * FROM roleLink WHERE roleID = ${roleID}`;
  connection.query(command, (err, result) => {
    if (err) {
      return res.json({ err });
    } else {
      return res.json({ roleLinks: result });
    }
  });
});

app.get('/globalLinks', (req, res) => {
  const command = `SELECT * FROM roleLink WHERE roleID = 6`;
  connection.query(command, (err, result) => {
    if (err) {
      return res.json({ err });
    } else {
      return res.json({ globalLinks: result });
    }
  });
});

app.post('/signUp', (req, res) => {
  const { firstName, lastName, username, password } = req.body;
  const command = `INSERT INTO admin_portal.person (firstName, lastName, username, password) VALUES ('${firstName}', '${lastName}', '${username}', '${password}')`;
  connection.query(command, (err, result) => {
    if (err) {
      return res.json({ err });
    } else {
      return res.json({ result });
    }
  });
});

app.get('/getRoles', (req, res) => {
  const command = `SELECT * 
  FROM admin_portal.roleName
  WHERE id NOT IN (1, 6)`;
  connection.query(command, (err, result) => {
    if (err) {
      return res.json({ err });
    } else {
      return res.json({ roleList: result });
    }
  });
});

app.get('/userInfo', (req, res) => {
  const command = `SELECT person.id, firstName, lastName,  userName, roleID,
  roleName.roleName
    FROM person, roleName
    WHERE person.roleID = roleName.id
    AND roleName != 'Super'`;
  connection.query(command, (err, result) => {
    if (err) {
      return res.json({ err });
    } else {
      return res.json({ personList: result });
    }
  });
});

app.post('/assignRole', (req, res) => {
  const { id, roleName } = req.body;
  const command = `UPDATE person
  SET person.roleID = (SELECT id from roleName where roleName = '${roleName}')
  WHERE person.id = ${id}`;
  connection.query(command, (err, result) => {
    if (err) {
      return res.json({ err });
    } else {
      return res.json({ result });
    }
  });
});

app.post('/getRoleLinks', (req, res) => {
  const { roleID } = req.body;
  const command = `SELECT roleLink, roleID, role
  FROM roleLink 
  WHERE roleID = '${roleID}'`;
  connection.query(command, (err, result) => {
    if (err) {
      return res.json({ err });
    } else {
      return res.json({ pickedRoleLinks: result });
    }
  });
});

app.post('/addToAdminList', (req, res) => {
  const { roleName } = req.body;
  const command = `INSERT INTO admin_portal.roleName (roleName) values ('${roleName}')`;
  connection.query(command, (err, result) => {
    if (err) {
      return res.json({ err });
    } else {
      return res.json({ result });
    }
  });
});

app.get('/getAdminName', (req, res) => {
  const command = `SELECT * FROM roleName WHERE roleName <> 'Super'`;
  connection.query(command, (err, result) => {
    if (err) {
      return res.json({ err });
    } else {
      return res.json({ adminList: result });
    }
  });
});

app.post('/modifyLink', (req, res) => {
  const { roleLink, newRoleLink, roleID, role } = req.body;
  const command = `UPDATE roleLink SET roleLink = '${newRoleLink}' 
  WHERE roleID = '${roleID}' AND role = '${role}' AND roleLink = '${roleLink}' `;
  connection.query(command, (err, result) => {
    if (err) {
      return res.json({ err });
    } else {
      return res.json({ adminList: result });
    }
  });
});

app.post('/modifyRoleName', (req, res) => {
  const { pickedRole, pickedRoleNewName, pickedRoleID } = req.body;
  const command = `UPDATE roleName SET roleName = '${pickedRoleNewName}' 
  WHERE id = ${pickedRoleID} AND roleName = '${pickedRole}'`;
  connection.query(command, (err, result) => {
    if (err) {
      return res.json({ err });
    } else {
      return res.json({ adminList: result });
    }
  });
});

app.delete('/deleteRole', (req, res) => {
  const { role } = req.body;
  const command = `DELETE FROM roleName WHERE roleName = '${role}'`;
  connection.query(command, (err, result) => {
    if (err) {
      return res.json({ err });
    } else {
      return res.json({ message: 'Successfully deleted record' });
    }
  });
});

app.listen(5000, () => 'Server started on port 5000');

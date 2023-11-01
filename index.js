const express = require('express');
const {
    readFile
} = require('fs');
const {
    Pool
} = require('pg');
const session = require('express-session');
const bodyParser = require('body-parser');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'users',
    password: 'bazepodataka',
    port: 5433, // PostgreSQL default port
});
const crypto = require('crypto');
const secretKey = crypto.randomBytes(32).toString('hex');

const app = express();
app.set('view engine', 'ejs');
app.use(session({
    secret: secretKey,
    resave: true,
    saveUninitialized: true
}));
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(express.static('public', {
    'extensions': ['css']
}));
app.use(express.static("public"));



app.get('/initialize', (req, res) => {
    pool.query('SELECT ime, prezime FROM users WHERE username = $1 AND password = $2', ['test123', '12345678'], (err, result) => {
        if (err) {
            console.error('Error querying the database:', err);
            res.status(500).send('Database error');
            return;
        }

        if (result.rows.length > 0) {
            req.session.ime = result.rows[0].ime;
            req.session.prezime = result.rows[0].prezime;
            res.status(200).send('Vec postoji')
        } else {
            pool.query('INSERT INTO users(id, ime, password, prezime, username) VALUES( $1 , $2 , $3, $4 , $5 );', ['1 ', 'Pero', '12345678', 'Peric', 'test123'], (err, result) => {
                if (err) {
                    console.error('Error querying the database:', err);
                    res.status(500).send('Database error');
                    return;
                } else {
                    res.status(200).send('Uspjesno inicijalizirano')

                }
            });
        }
    });
})



app.get('/', (req, res) => {

    const isVulnerable = req.query.isVulnerable === 'true';
    const poruka = req.session.error;
        const poruka2 = req.session.error2;

    pool.query('SELECT ime, komentar FROM komentari;', (err, result) => {
        if (err) {
            console.error('Error querying the database:', err);
            res.status(500).send('Database error');
            return;
        }

        const rows = result.rows;
        const contentList = rows.map(row => ({
            ime: row.ime,
            komentar: row.komentar
        }));

        res.render('home', {
            session: req.session,
            lista: contentList,
            isVulnerable: isVulnerable || false,
            poruka: poruka,
            poruka2: poruka2
        });
    });
});

app.get('/login', (req, res) => {

    res.render('login');

})


app.post('/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    pool.query('SELECT ime, prezime FROM users WHERE username = $1 AND password = $2', [username, password], (err, result) => {
        if (err) {
            console.error('Error querying the database:', err);
            res.status(500).send('Database error');
            return;
        }

        if (result.rows.length > 0) {
            req.session.ime = result.rows[0].ime;
            req.session.prezime = result.rows[0].prezime;
            res.redirect('/');
        } else {
            res.status(401).send('Invalid username or password');
        }
    });
});

app.post('/xss', (req, res) => {
    const lista = req.body.lista;
    const ime = req.session.ime || 'Anonymous';
    console.log(req.body.isVulnerable);
    const isVulnerable = req.body.isVulnerable;


    pool.query('INSERT INTO komentari(ime, komentar) VALUES( $1, $2);', [ime, lista], (err, result) => {
        if (err) {
            console.error('Error querying the database:', err);
            res.status(500).send('Database error');
            return;
        }
    });

    const putanja = `/?isVulnerable=${isVulnerable}`
    res.redirect(putanja);


});

app.post('/brokenauth', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    pool.query('SELECT * FROM users WHERE username = $1', [username], (err, result) => {
        if (err) {
            console.error('Error querying the database:', err);
            return res.status(500).send('Database error');
        }

        if (result.rows.length <= 0) {
            req.session.error = `Username ${username} ne postoji.`;
            return res.redirect("/");
        }

        pool.query('SELECT ime, prezime FROM users WHERE username = $1 AND password = $2', [username, password], (err, result) => {
            if (err) {
                console.error('Error querying the database:', err);
                return res.status(500).send('Database error');
            }

            if (result.rows.length > 0) {
                return res.redirect('/');
            } else {
                req.session.error = "Neispravna lozinka.";
                return res.redirect("/");
            }
        });
    });
});


const maxLoginAttempts = 3; // Maximum allowed login attempts
const blockDuration = 5 * 60 * 1000; // 5 minutes in milliseconds

app.post('/auth', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    // Initialize login attempts and last failed attempt time
    if (!req.session.loginAttempts) {
        req.session.loginAttempts = 0;
        req.session.lastFailedAttemptTime = null;
    }

    // Check if login attempts are blocked
    if (
        req.session.loginAttempts >= maxLoginAttempts &&
        req.session.lastFailedAttemptTime &&
        Date.now() - req.session.lastFailedAttemptTime < blockDuration
    ) {
        // Block login attempts
        const timeLeft = blockDuration - (Date.now() - req.session.lastFailedAttemptTime);
        req.session.error2 = `Login attempts are blocked. Try again in ${timeLeft / 1000} seconds.`;
        return res.redirect("/");
    }

    // Attempt to authenticate the user
    pool.query('SELECT ime, prezime FROM users WHERE username = $1 AND password = $2', [username, password], (err, result) => {
        if (err) {
            console.error('Error querying the database:', err);
            return res.status(500).send('Database error');
        }

        if (result.rows.length > 0) {
            // Successful login
            req.session.loginAttempts = 0; // Reset login attempts
            req.session.lastFailedAttemptTime = null;
            return res.redirect('/');
        } else {
            // Failed login attempt
            req.session.loginAttempts++;
            req.session.lastFailedAttemptTime = Date.now();
            req.session.error2 = 'Invalid username or password';
            return res.redirect("/");
        }
    });
});




app.listen(process.env.PORT || 3000)
const express = require('express');
const { readFile } = require('fs');
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


const app = express();
app.set('view engine', 'ejs');

const crypto = require('crypto');
const secretKey = crypto.randomBytes(32).toString('hex');


app.use(session({
    secret: secretKey, 
    resave: true,
    saveUninitialized: true
}));

app.use(bodyParser.urlencoded({
    extended: true
}));



app.get('/', (req, res) => {
    pool.query('SELECT content FROM content;', (err, result) => {
        if (err) {
            console.error('Error querying the database:', err);
            res.status(500).send('Database error');
            return;
        }

        const rows = result.rows;
        const contentList = rows.map(row => row.content);

        res.render('home', {
            session: req.session,
            lista: contentList, // Dodajte listu pod ključem "lista"
        });
    });
});

app.get('/login', (req, res) => {

    readFile('./login.html', 'utf-8', (err, html) => {
        res.send(html);
    })

})

app.get('/xss', (req, res) => {

    readFile('./xss.html', 'utf-8', (err, html) => {
        res.send(html);
    })

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
            // Ako su korisničko ime i lozinka tačni, postavite ime i prezime u sesiju
            req.session.ime = result.rows[0].ime;
            req.session.prezime = result.rows[0].prezime;
            console.log(req.session.ime);
            // Preusmerite korisnika na željenu stranicu nakon prijave
            res.redirect('/');
        } else {
            // Ako su korisničko ime i lozinka netačni, prikažite poruku o grešci
            res.status(401).send('Invalid username or password');
        }
    });
});

app.post('/xss', (req, res) => {
    const lista = req.body.lista;

    pool.query('INSERT INTO content( content) VALUES( $1);', [lista], (err, result) => {
        if (err) {
            console.error('Error querying the database:', err);
            res.status(500).send('Database error');
            return;
        }
    });


        // Pošaljite generirani HTML na stranicu "home"
                    res.redirect('/');

    
});

app.listen(process.env.PORT || 3000)
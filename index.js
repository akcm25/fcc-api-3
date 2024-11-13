require('dotenv').config();

const express = require('express');
const cors = require('cors');
const dns = require('dns');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

const client = new MongoClient(process.env.URI);

app.use(cors());
app.use('/public', express.static(`${process.cwd()}/public`));
app.use('/api/shorturl', bodyParser.urlencoded({ extended: false }));

(async function connectDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  }
})();

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

app.post('/api/shorturl', async (req, res) => {
  let url = req.body.url;

  // Validate URL format
  const regex = /^http(s)?:\/\//;
  if (!regex.test(url)) {
    return res.json({ error: "Invalid URL" });
  }

  // Extract hostname for DNS lookup
  const hostname = new URL(url).hostname;

  // Verify hostname
  dns.lookup(hostname, async (err) => {
    if (err) return res.json({ error: "Invalid Hostname" });

    try {
      const db = client.db("fcc-mongodb");
      const urlsCollection = db.collection("urls");

      // Check if URL already exists
      const existingUrl = await urlsCollection.findOne({ original: url });
      if (existingUrl) {
        return res.json({ original_url: existingUrl.original, short_url: existingUrl.short });
      }

      // Insert new URL with a short URL
      const newId = await urlsCollection.countDocuments() + 1;
      const newUrlEntry = { original: url, short: newId };
      await urlsCollection.insertOne(newUrlEntry);

      res.json({ original_url: url, short_url: newId });
    } catch (error) {
      console.error(error);
      res.json({ error: "Server error" });
    }
  });
});


app.get('/api/shorturl/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const db = client.db("fcc-mongodb");
    const urlsCollection = db.collection("urls");

    // Find URL by short id
    const urlEntry = await urlsCollection.findOne({ short: id });

    if (urlEntry) {
      return res.redirect(urlEntry.original);
    } else {
      res.json({ error: "No URL found for the given short URL" });
    }
  } catch (error) {
    console.error(error);
    res.json({ error: "Server error" });
  }
});


app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});

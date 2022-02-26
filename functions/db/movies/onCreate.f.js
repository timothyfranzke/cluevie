const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const fs = require("fs");
const tmpdir = require('os').tmpdir;
const join = require('path').join;

const serviceAccount = require("../." + functions.config().service.account);
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: functions.config().service.db,
  });
} catch (e) {
  console.log(e);
}

const gcs = admin.storage();

exports = module.exports = functions.firestore.document("/movies/{movieId}")
    .onCreate(async (snapshot, context) => {
      const movieId = context.params.movieId;

      if (snapshot.data()) {
        const movieListResponse = await axios.get(`https://${functions.config().storage.movie.name}/movies.json`);
        const movieList = movieListResponse.data;
        const movie = snapshot.data();
        const bucket = gcs.bucket(functions.config().storage.movie.name);
        movie.id = movieId;
        console.log('movie', movie);
        try {
          movieList.push(movie);
          fs.writeFile(join(tmpdir(),"movies.json"), JSON.stringify(movieList),
            async (err) => {
                        if (err) {
                          console.error(err);
                          throw err;
                        }
                        await bucket.upload(join(tmpdir(),"movies.json"), {destination: "movies.json"});
                        fs.remove(join(tmpdir(),"movies.json"));
          });
        } catch (err) {
          console.error(err);
        }
      }
    });



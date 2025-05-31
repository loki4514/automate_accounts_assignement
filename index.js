import express from 'express';
import dotenv from 'dotenv';
import apiRoutes from './routes/index.js'



dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;


// Middleware
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));


app.get('/', (req, res) => {
    res.send('Server is up and running with ES6 imports!');
});

app.use("/api/v1", apiRoutes)

app.listen(PORT, () => {
    console.log(`Server running on port: ${PORT}`);
});
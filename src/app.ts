import express, { Request, Response } from "express"
import cors from "cors"
import cookieParser from "cookie-parser";
import qs from "qs";
import { IndexRoutes } from "./app/routes";


const app = express()

app.use(cookieParser())

app.set("query parser", () => (str: string) => qs.parse(str))

app.use(cors({
    origin: ["http://localhost:3000", "http://localhost:5000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"]
}))

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());

app.use('/api/v1', IndexRoutes);

app.get('/', (req: Request, res: Response) => {
    res.send('Server is running');
});

export default app;
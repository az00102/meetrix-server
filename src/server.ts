import app from "./app";
import { envVars } from "./config/env";

const bootstrap = async () => {
    const port = envVars.PORT;
    try {
        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    } catch (error) {
        console.error("Failed to start the server:", error);
    }
}

bootstrap();
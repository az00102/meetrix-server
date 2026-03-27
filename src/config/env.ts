import dotenv from "dotenv";

dotenv.config();

interface EnvConfig {
    NODE_ENV: string;
    PORT: string;
}

const loadEnvVariables = (): EnvConfig => {

    const requiredEnvVars = [
        "NODE_ENV",
        "PORT",
    ];

    requiredEnvVars.forEach((variable) => {
        if (!process.env[variable]) {
            throw new Error(`Environment variable ${variable} is required but not defined.`);
        }
    })

    return {
        NODE_ENV: process.env.NODE_ENV as string,
        PORT: process.env.PORT as string,
    }
}

export const envVars = loadEnvVariables();
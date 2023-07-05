#! /usr/bin/env node

// Path: bin.js

import os from 'os';
import path, { parse } from 'path';
import readline from 'readline';
import fs from 'fs';
import chalk from 'chalk';
import { exec, spawn } from 'child_process';

const platform = os.platform();

const args = process.argv.slice(2);

let workPath = '';

function parseText(text) {
    let matches = text.match(/\[([a-zA-Z]+)\s([^\]]+)\]/g);

    let parsedText = text;

    if (matches) {
        for (let match of matches) {
            let [_, color, text] = match.match(/\[([a-zA-Z]+)\s([^\]]+)\]/);

            parsedText = parsedText.replace(match, chalk[color](text));
        }
    }

    return parsedText;
}

function log(...text) {
    // Parse the text, for ex "[blueBright hello]" -> chalk.blueBright("hello")

    let textToLog = text.map(parseText);

    console.log(...textToLog);
}

async function readInput(q) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
        prompt: q
    });

    return new Promise((resolve, reject) => {
        rl.question(q, (answer) => {
            rl.close();

            let parsedAnswer = answer.trim();

            // Parse backspaces

            let backspaces = parsedAnswer.match(/\x08/g);

            if (backspaces) {
                for (let backspace of backspaces) {
                    parsedAnswer = parsedAnswer.replace(backspace + parsedAnswer[parsedAnswer.indexOf(backspace) + 1], '');
                }
            }

            resolve(parsedAnswer);
        });
    });
}

if (args.length > 0) {
    workPath = args[0];

    // If the path is relative, make it absolute
    if (!workPath.startsWith('/')) {
        workPath = path.join(process.cwd(), workPath);
    }

    if (platform === 'win32') {
        workPath = workPath.replace(/\\/g, '/');
    }
} else {
    // Ask the user for the name of the project, then create the directory

    let name = await readInput(parseText("[yellow Project name: ]"));

    workPath = path.join(process.cwd(), name);
}

let answer = await readInput(parseText("[yellow Install Nuxt 3 in ] [blueBright " + workPath + "]? (Yes/<No>) "));

if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
    log("[redBright Aborting...]");
    process.exit(0);
}

// Check if the directory exists

if (!fs.existsSync(workPath)) {
    fs.mkdirSync(workPath);
}

let hasForce = false;

if (args.includes('--force') || args.includes('-f')) {
    hasForce = true;
}

// Check if the directory is empty

let files = fs.readdirSync(workPath);

if (files.length > 0 && !('.git' in files) && !hasForce) {
    log("\n[redBright FATAL: The directory is not empty. ]");

    log("[yellow If you want to force the installation, use the --force or -f flag]");
    process.exit(0);
}

// Scaffold the project

let packageJson = {
    "name": "nuxtapp",
    "private": true,
    "scripts": {
      "build": "nuxt build",
      "dev": "nuxt dev",
      "generate": "nuxt generate",
      "preview": "nuxt preview",
      "postinstall": "nuxt prepare"
    },
    "devDependencies": {
      "@nuxt/devtools": "latest",
      "@types/node": "^18",
      "nuxt": "^3.6.1"
    }
}

fs.writeFileSync(path.join(workPath, 'package.json'), JSON.stringify(packageJson, null, 2));

// Ask for customization options

let nuxtJSConfig = {}

let renderMode = await readInput(parseText("[yellow Render mode: ] (<SSR>/SSG/SPA)"));


let packageManager = await readInput(parseText("[yellow Package manager: ] (<NPM>/Yarn)"));

if (packageManager.toLowerCase() === 'yarn') {
    fs.writeFileSync(path.join(workPath, 'yarn.lock'), '');
}

let cssFramework = await readInput(parseText("[yellow CSS framework: ] (<None>/Tailwind)"));

if (cssFramework.toLowerCase() === 'tailwind') {
    packageJson.devDependencies['@nuxtjs/tailwindcss'] = '^4.0.0';

    nuxtJSConfig['modules'] = [
        '@nuxtjs/tailwindcss'
    ]
}

let cssPreprocessor = await readInput(parseText("[yellow CSS preprocessor: ] (<None>/Sass)"));

if (cssPreprocessor.toLowerCase() === 'sass') {
    packageJson.devDependencies['sass'] = '^1.42.1';
    packageJson.devDependencies['sass-loader'] = '^12.1.0';
}

let devTools = await readInput(parseText("[yellow Enable Nuxt Devtools?] (<Yes>/No)"));

if (devTools.toLowerCase() === 'y' || devTools.toLowerCase() === 'yes') {
    packageJson.devDependencies['@nuxtjs/devtools'] = '^1.0.0';

    nuxtJSConfig['devtools'] = {
        enabled: true
    }
}

// Create the nuxt.config.js file

let nuxtConfigString = JSON.stringify(nuxtJSConfig, null, 2);

fs.writeFileSync(path.join(workPath, 'nuxt.config.js'), nuxtConfigString);

// Install the dependencies

log("\n[yellow Installing dependencies, This may take a while.]");

log("\n[whiteBright > " + packageManager.toLowerCase() + " install]")

let installCommand = packageManager.toLowerCase() === 'yarn' ? 'yarn' : 'npm install';

let installProcess = exec(installCommand, {
    cwd: workPath
});

installProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
});

// Wait until the process exits

await new Promise((resolve, reject) => {
    installProcess.on('exit', (code) => {
        if (code === 0) {
            // Done!
    
            log("\n[greenBright Done!]\n");
    
            log("[yellow To start the development server, run][blueBright " + packageManager.toLowerCase() + " run dev]");
            log("[yellow To build for production, run][blueBright " + packageManager.toLowerCase() + " run build]");
            log("[yellow To start the production server, run][blueBright " + packageManager.toLowerCase() + " run start]");
            log("[yellow To generate static files, run][blueBright " + packageManager.toLowerCase() + " run generate]");
    
            log("\n[greenBright Happy coding!]")
    
            resolve();
        } else {
            log("\n[redBright FATAL: Failed to install dependencies.]");
            reject();
        }
    });
}).catch((err) => {
    log("\n[redBright FATAL: Failed to install dependencies.]");
    process.exit(0);
});


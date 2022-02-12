const { Client, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const bodyParser = require('body-parser')
const qrcode = require('qrcode-terminal');
const ora = require('ora');
const exceljs = require('exceljs');
const chalk = require('chalk');
const fs = require('fs');
const moment = require('moment');
const cors = require('cors');
const app = express();

const SESSION_FILE_PATH = './session.json';

let client;
let sessionData;

app.use(cors())
app.use(bodyParser.urlencoded());

app.use(bodyParser.json());


const sendWithApi = (req,res)=>{
    const {message,to}=req.body;
    const newNumber=`521${to}@c.us`
    console.log(message,to);

    sendMessage(newNumber,message)

    res.send({status : 'Enviado'})
}

app.post('/send', sendWithApi)

const withSession = () => {
    //Si existe, se carga el archivo con las credenciales
    const spinner = ora(`Cargando ${chalk.yellow('Validando sesión con WhatsApp...')}`);
    sessionData=require(SESSION_FILE_PATH);
    spinner.start();
    client = new Client({
        session:sessionData
    });
    client.on('ready',()=>{
        console.log('Client is ready!');
        spinner.stop();
        listenMessage();
    })
    client.on('auth_failure',()=>{
        spinner.stop();
        console.log('** Error de autentificacion, vuelve a generar el QRCODE (Borrar el archivo session.js) **')
    })
    client.initialize();
}

/*Esta funcion genera el QR code*/
const withOutSession = () => {
    console.log('No tenemos una sesion guardada');
    client = new Client();
    client.on('qr',qr=>{
        qrcode.generate(qr,{small:true});
    });
    client.on('authenticated',(session)=>{
        //Se guardan las credenciales de session para usar luego
        sessionData=session;
        fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), (err) => {
            if(err){
                console.log(err);
            }
        });
    });
    client.initialize();
}

/** Esta funcion se encarga de escuchar cada vez que entra un mensaje nuevo*/

const listenMessage=()=>{
    client.on('message',(msg)=>{
        const {from, to, body}=msg;
        
        if(from != 'status@broadcast' && from !='5218714058763@c.us'){
            switch (body) {
                case 'Hola':
                    sendMessage(from, 'Hola, ¿cómo estás?')
                    /* sendMedia(from, 'descarga.jpg') */
                    break;
                default:
                    sendMessage(from, 'Lo siento, no tengo una respuesta para eso.')
                    break;
            }
            saveHistorial(from, body)
            console.log(`${chalk.greenBright(from, body)}`)
        }
    })
}

const sendMedia = (to, file) => {
    const mediaFile = MessageMedia.fromFilePath(`./mediaSend/${file}`)
    client.sendMessage(to, mediaFile)
}

const sendMessage = (to,message) =>{

    client.sendMessage(to,message)
}

const saveHistorial = (number, message) => {
    const pathChat = `./chats/${number}.xlsx`;
    const workbook = new exceljs.Workbook();
    const today = moment().format('DD-MM-YYYY hh:mm:ss a')

    if(fs.existsSync(pathChat)){
        workbook.xlsx.readFile(pathChat)
        .then(()=>{
            const worksheet = workbook.getWorksheet(1);
            const lastRow = worksheet.lastRow;
            let getRowInsert = worksheet.getRow(++(lastRow.number))
            getRowInsert.getCell('A').value = today;
            getRowInsert.getCell('B').value = message;
            getRowInsert.commit();
            workbook.xlsx.writeFile(pathChat)
            .then(()=>{
                console.log('Se agrego nuevo chat al historial')
            })
            .catch(()=>{
                console.log('Algo ocurrio guardando el chat')
            })
        })
    }
    else{
        const worksheet = workbook.addWorksheet('Chats');
        worksheet.columns=[
            {header:'Fecha', key: 'date'},
            {header: 'Mensaje', key: 'message'}
        ]
        worksheet.addRow([today, message])
        workbook.xlsx.writeFile(pathChat)
        .then(()=>{
            console.log('Historial creado');
        })
        .catch(()=>{
            console.log('Algo paso')
        })
    }
}

/*Revisa si ya tiene sesión activa o no*/
(fs.existsSync(SESSION_FILE_PATH)) ? withSession() : withOutSession();

app.listen(9000,()=>{
    console.log('API ESTA ARRIBA')
})
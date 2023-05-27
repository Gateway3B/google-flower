import dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { GoogleDriveService } from './GoogleDriveService';

dotenv.config();

const driveClientId = process.env.GOOGLE_DRIVE_CLIENT_ID || '';
const driveClientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || '';
const driveRedirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || '';
const driveRefreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '';

const minsToMillisecs = (mins: number) => {
    return mins * 60 * 1000;
}

const main = async () => {
    const googleDriveService = new GoogleDriveService(driveClientId, driveClientSecret, driveRedirectUri, driveRefreshToken);
    
    const fileName = 'Obsidian';
    const folder = await googleDriveService.getFolder(fileName);

    if (!folder) return;

    const folderId = folder.files[0].id;
    const files = await googleDriveService.getFilesInFolderRecursive(folderId, fileName);

    const currTime = new Date().getTime();

    const hasUpdate = !files.every(file => {
        const fileTime = new Date(file.modifiedTime).getTime();
        if (currTime - fileTime < minsToMillisecs(10)) {
            return false;
        }

        return true;
    });

    if (!hasUpdate) return;

    googleDriveService.downloadFiles(files);


}

main();

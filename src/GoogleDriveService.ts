import { google } from 'googleapis';
import fs from 'fs';

enum MimeType {
    Folder = 'application/vnd.google-apps.folder',
    MarkDown = 'application/markdown'
}

type PartialDriveFile = {
    id: string;
    name: string;
    modifiedTime: string; // (RFC 3339 date-time),
    mimeType: MimeType;
    path?: string;
};

type SearchResultResponse = {
    kind: 'drive#fileList';
    nextPageToken: string;
    incompleteSearch: boolean;
    files: PartialDriveFile[];
};

export class GoogleDriveService {
    private driveClient;
  
    public constructor(clientId: string, clientSecret: string, redirectUri: string, refreshToken: string) {
        this.driveClient = this.createDriveClient(clientId, clientSecret, redirectUri, refreshToken);
    }
  
    createDriveClient(clientId: string, clientSecret: string, redirectUri: string, refreshToken: string) {
        const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

        client.setCredentials({ refresh_token: refreshToken });

        return google.drive({
            version: 'v3',
            auth: client,
        });
    }

    getFolder(folderName: string): Promise<SearchResultResponse | null> {
        return this.driveListQuery(`mimeType='${MimeType.Folder}' and name='${folderName}'`);
    }

    getFilesInFolderRecursive(folderId: string, folderName: string): Promise<PartialDriveFile[]> {
        return new Promise(async (resolve, reject) => {
        
            const folder = await this.getFilesInFolder(folderId)
            const files: PartialDriveFile[] = [];
            const folderFilePromises: Promise<PartialDriveFile[]>[] = [];

            folder?.files.forEach((file) => {
                if (file.mimeType === MimeType.Folder) {
                    if (file.name !== '.obsidian') {
                        const folderFilePromise = this.getFilesInFolderRecursive(file.id, file.name);
                        folderFilePromises.push(folderFilePromise);
                    }
                } else {
                    file.path ??= '';
                    file.path += `${folderName}/${file.name}`;
                    files.push(file);
                }
            });

            const folderFiles = await Promise.all(folderFilePromises);

            const allAwaitedFiles = folderFiles.reduce((allFiles, files) => {
                allFiles.push(...files);
                return allFiles;
            }, []);

            files.push(...allAwaitedFiles);

            return resolve(files);
        });
    }

    getFilesInFolder(folderId: string): Promise<SearchResultResponse | null> {
        return this.driveListQuery(`'${folderId}' in parents`);
    }

    downloadFiles(files: PartialDriveFile[]) {
        return new Promise(async (resolve, reject) => {
            const filePromises: Promise<any>[] = [];

            files.forEach(file => {
                const filePromise = this.driveClient.files.get({
                    fileId: file.id
                });

                filePromises.push(filePromise);
            });

            await Promise.all(filePromises);
        });
    }

    private driveListQuery(query: string): Promise<SearchResultResponse | null> {
        return new Promise((resolve, reject) => {
            return this.driveClient.files.list(
                {
                    q: `${query}`,
                    fields: 'files(id, name, modifiedTime, mimeType)',
                    pageSize: 1000
                })
                .catch(err => {
                    return reject(err);
                })
                .then(res => {
                    if (!res) {
                        return null;
                    }
                    return resolve(res.data ? res.data as SearchResultResponse : null);
                });
        });
    }
}
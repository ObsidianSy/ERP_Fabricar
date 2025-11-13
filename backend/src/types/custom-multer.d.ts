declare module 'multer';

declare global {
    namespace Express {
        interface Multer {
            File: any;
        }
    }
}

export {};
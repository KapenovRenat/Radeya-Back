import {S3Client} from "@aws-sdk/client-s3";
import {Env} from "@config/env";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const s3 = new S3Client({
    region: Env.YANDEX_S3_REGION,
    endpoint: Env.YANDEX_S3_ENDPOINT, // https://storage.yandexcloud.net
    credentials: {
        accessKeyId: Env.YANDEX_S3_ACCESS_KEY_ID,
        secretAccessKey: Env.YANDEX_S3_SECRET_ACCESS_KEY,
    },
});

export async function uploadFileToYandex(
    file: Express.Multer.File,
    keyPrefix: string
): Promise<string | null> {
    try {
        const ext = file.originalname.split(".").pop() || "bin";
        const key = `${keyPrefix}/${randomUUID()}.${ext}`;

        await s3.send(
            new PutObjectCommand({
                Bucket: Env.YANDEX_S3_BUCKET,
                Key: key,
                Body: file.buffer,          // у тебя memoryStorage, так что buffer есть
                ContentType: file.mimetype,
                ACL: "public-read",         // если бакет публичный
            })
        );

        // базовый публичный URL (если без CDN/своего домена)
        return `${Env.YANDEX_S3_ENDPOINT}/${Env.YANDEX_S3_BUCKET}/${key}`;
    } catch (e) {
        console.log('Ошибка загрузки файла на Яндекс: ', e);
        return null
    }
}

/** Загрузка нескольких файлов и возврат массива URL */
export async function uploadManyFilesToYandex(
    files: Express.Multer.File[],
    keyPrefix: string
): Promise<string[] | null> {
    try {
        const urls: string[] = [];

        for (const file of files) {
            const url = await uploadFileToYandex(file, keyPrefix);
            if (typeof url === "string") {
                urls.push(url);
            }
        }

        return urls;
    } catch (e) {
        console.log('Ошибка загрузки файлов на Яндекс: ', e);
        return null;
    }
}

export function fixPrefix(prefix: any) {
    return prefix.split('-').pop()?.trim() || '';
}
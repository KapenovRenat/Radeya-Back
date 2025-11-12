import { Schema, model, Document } from "mongoose";

export interface IProduct extends Document {
    article: string;
    name: string;
    isActiveKaspi?: string;
    storeId?: string;
    storeOrder?: string;
    currentPrice?: number;
    previewImgUrl?: string;
    description?: string;
    brand?: string;
    attributes?: {code: string, value?: any, values?: any}[];
    imagesKM?: {url: string}[];
    category?: string;
    status?: string;
    korobs?: number;
    uniqueCode?: string
}

const productSchema = new Schema<IProduct>(
    {
        article: { type: String, required: true, unique: true, trim: true },
        uniqueCode: { type: String, required: false },
        name: { type: String, required: true },
        isActiveKaspi: { type: String, required: false },
        storeId: { type: String, required: false },
        category: { type: String, required: false },
        storeOrder: { type: String, required: false },
        currentPrice: { type: Number, required: false },
        korobs: { type: Number, required: false },
        description: { type: String, required: false },
        brand: { type: String, required: false },
        status: { type: String, required: false },
        attributes: [
            {
                code: { type: String, required: true },
                value: { type: Schema.Types.Mixed, required: false },
            },
        ],
        previewImgUrl: { type: String, required: false },
        imagesKM: [
            { url: {type: String, required: false} }
        ],
    },
    { timestamps: true, versionKey: false }
);

// не отдаём пароль наружу
productSchema.set("toJSON", {
    transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        return ret;
    },
});

export const Product = model<IProduct>("Product", productSchema);
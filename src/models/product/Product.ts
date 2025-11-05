import { Schema, model, Document } from "mongoose";

export interface IProduct extends Document {
    article: string;
    name: string;
    isActiveKaspi?: string;
    storeId?: string;
    storeOrder?: string;
    currentPrice?: number;
    previewImgUrl?: string;
}

const productSchema = new Schema<IProduct>(
    {
        article: { type: String, required: true, unique: true, trim: true },
        name: { type: String, required: true },
        isActiveKaspi: { type: String, required: false },
        storeId: { type: String, required: false },
        storeOrder: { type: String, required: false },
        currentPrice: { type: Number, required: false },
        previewImgUrl: { type: String, required: false }
    },
    { timestamps: true, versionKey: false }
);

// не отдаём пароль наружу
productSchema.set("toJSON", {
    transform: (_doc, ret: any) => {
        delete ret.password;
        ret.id = ret._id;
        delete ret._id;
        return ret;
    },
});

export const Product = model<IProduct>("Product", productSchema);
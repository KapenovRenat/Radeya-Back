// Модель для таблицы Учета

import { Schema, model, Document } from "mongoose";

export interface IAccounting extends Document {
    type: string;
    name: Date;
    createdAt: Date;
    updatedAt: Date;
}

const accountingSchema = new Schema<IAccounting>(
    {
        name: { type: Date, required: true },
        type: { type: String, required: true },
    },
    { timestamps: true, versionKey: false }
);

// не отдаём пароль наружу
accountingSchema.set("toJSON", {
    transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        return ret;
    },
});

export const Accounting = model<IAccounting>("Accounting", accountingSchema);
import { Schema, model, Document } from "mongoose";

export interface ISupplier extends Document {
    msId: string;
    name: string;
    externalCode?: string | null;
    companyType?: string | null;
    phone?: string | null;
    email?: string | null;
    actualAddress?: string | null;
    tags: string[];
    archived: boolean;
    salesAmount: number;
    createdAtMs?: string | null;
    updatedAtMs?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
    {
        msId: { type: String, required: true, unique: true, index: true },
        name: { type: String, required: true },
        externalCode: { type: String, default: null },
        companyType: { type: String, default: null },
        phone: { type: String, default: null },
        email: { type: String, default: null },
        actualAddress: { type: String, default: null },
        tags: { type: [String], default: [] },
        archived: { type: Boolean, default: false },
        salesAmount: { type: Number, default: 0 },
        createdAtMs: { type: String, default: null },
        updatedAtMs: { type: String, default: null },
    },
    { timestamps: true, versionKey: false }
);

SupplierSchema.set("toJSON", {
    transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        return ret;
    },
});

export const Supplier = model<ISupplier>("Supplier", SupplierSchema);

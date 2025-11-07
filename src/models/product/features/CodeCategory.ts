import { Schema, model, Document } from "mongoose";

export interface ICodeCategory extends Document {
    code: string;
    title: string;
}

const codeCategorySchema = new Schema<ICodeCategory>(
    {
        code: { type: String, required: true },
        title: { type: String, required: true },
    },
    { timestamps: true, versionKey: false }
);

// не отдаём пароль наружу
codeCategorySchema.set("toJSON", {
    transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        return ret;
    },
});

export const CodeCategory = model<ICodeCategory>("CodeCategory", codeCategorySchema);
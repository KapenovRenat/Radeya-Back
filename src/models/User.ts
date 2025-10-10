import { Schema, model, Document } from "mongoose";

export type UserRole = "user" | "admin" | "manager";

export interface IUser extends Document {
    login: string;
    password: string; // храним хэш
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new Schema<IUser>(
    {
        login: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true, minlength: 6, select: false },
        role: { type: String, enum: ["user", "admin", "manager"], default: "user", required: true }
    },
    { timestamps: true, versionKey: false }
);

// не отдаём пароль наружу
userSchema.set("toJSON", {
    transform: (_doc, ret: any) => {
        delete ret.password;
        ret.id = ret._id;
        delete ret._id;
        return ret;
    },
});

export const User = model<IUser>("User", userSchema);
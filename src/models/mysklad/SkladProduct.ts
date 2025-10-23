import { Schema, model, Document } from "mongoose";

export type WarehouseKey = "astana" | "pavlodar" | "kostanay";

export interface ISkladProduct extends Document {
    // Идентификаторы
    msId: string;               // UUID товара в МойСклад
    article?: string | null;    // product.article

    // Основное
    name: string;
    imageUrl?: string | null;   // ссылка на первую картинку из /images
    supplier?: {
        msId: string;
        name: string;
    } | null;

    // Цены (в ТИЫНАХ/копейках, целые числа)
    purchasePrice?: number | null;      // product.buyPrice.value
    kaspiPrice?: number | null;         // из salePrices["Каспи"].value

    // Маркетплейс
    kaspiLink?: string | null;          // из кастомного атрибута в МС (если есть)

    // Остатки по складам (штуки)
    stock: {
        astana: number;
        pavlodar: number;
        kostanay: number;
        total: number;                    // суммарный остаток (для удобства)
    };

    // Служебные
    updatedAtMs?: Date | null;          // product.updated из МС (когда товар менялся в МС)
    raw?: any;                          // опционально: сырой объект МС для дебага
    createdAt: Date;
    updatedAt: Date;
}

const SkladProductSchema = new Schema<ISkladProduct>(
    {
        msId: { type: String, required: true, unique: true, index: true },

        article: { type: String, default: null, index: true },

        name: { type: String, required: true, index: "text" },
        imageUrl: { type: String, default: null },

        supplier: {
            name: { type: String, required: false },
            count: { type: Number, required: false },
        },

        purchasePrice: { type: Number, default: null }, // целые, в тиынах
        kaspiPrice: { type: Number, default: null },    // целые, в тиынах
        kaspiLink: { type: String, default: null },

        updatedAtMs: { type: Date, default: null },
        raw: { type: Schema.Types.Mixed, default: undefined },
    },
    { timestamps: true, versionKey: false }
);

// Удобная проекция при отдаче наружу
SkladProductSchema.set("toJSON", {
    transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        // цены можно конвертировать в KZT для API (если нужно):
        // ret.purchasePriceKzt = ret.purchasePrice != null ? ret.purchasePrice / 100 : null;
        // ret.kaspiPriceKzt = ret.kaspiPrice != null ? ret.kaspiPrice / 100 : null;
        return ret;
    },
});

export const SkladProduct = model<ISkladProduct>("SkladProduct", SkladProductSchema);
import { Schema, model, Document } from "mongoose";

export interface IOrderObject {
    prId: string;                // id позиции из Kaspi
    type: string;                    // кол-во
    entryNumber?: number;                      // цена за штуку
    deliveryCost?: number;                 // сумма по позиции
    quantity?: number;                  // id товара
    weight?: number;                // ссылка на товар
    basePrice?: number;
    totalPrice?: number;
    unitType?: string;
    category: {
        code: string;
        title: string;
    };
    offer: {
        code: string;
        name: string;
    };
    isImeiRequired: boolean;
    product: {
        id: string;
        type: string;
        link: string;
    };
    deliveryPointOfService: {
        id: string;
        type: string;
        link: string;
    }
}

export interface IOrder extends Document {
    // Идентификаторы
    kmId: string;               // UUID товара в МойСклад
    code: string | null;    // код заказа
    type: string | null;
    creationDate: number | null;    // дата заказа
    totalPrice: number | null;    // сумма заказа
    deliveryCostForSeller: number | null;    // сумма за доставку
    isKaspiDelivery: boolean;    // Доставка каспи?
    preOrder: boolean;    // -
    approvedByBankDate: number | null;    // дата одобрения банка
    signatureRequired: boolean;    // нужна ли подпись
    status: string | null;    // статус заказа
    pickupPointId: string | null;    // -
    state: string | null;    // Состояние заказа
    deliveryCost: number | null;    // Состояние заказа

    // Данные Клиента
    customer: {
        id: string | null;
        name: string | null;
        cellPhone: string | null;
        firstName: string | null;
        lastName: string | null;
    }

    // Адрес доставки
    deliveryAddress: {
        streetName: string | null;
        streetNumber: string | null;
        town: string | null;
        formattedAddress: string | null;
        district: any,
        building: any,
        apartment: any,
        latitude: any,
        longitude: any
    }

    // Адрес отгрузки
    originAddress: {
        id: string | null,
        displayName: string | null,
        address: {
            streetName: string | null,
            streetNumber: string | null,
            town: string | null,
            district: any,
            building: string | null,
            apartment: any,
            formattedAddress: string | null,
            latitude: number | null,
            longitude: number | null
        },
        city: {
            id: string | null,
            code: string | null,
            name: string | null,
            active: boolean
        }
    }

    // Каспи доставка
    kaspiDelivery: {
        waybill: string | null;
        courierTransmissionDate: number | null;
        courierTransmissionPlanningDate: number | null;
        waybillNumber: string | null,
        express: boolean,
        returnedToWarehouse: boolean,
        firstMileCourier: any
    }

    assembled: boolean,
    creditTerm: number | null;
    deliveryMode: string | null;
    paymentMode: string | null;

    objects: IOrderObject[];
}

// Подсхема для items (objects)
const OrderObjectSchema = new Schema<IOrderObject>(
    {
        prId: { type: String },              // id позиции из Kaspi
        type: { type: String },                   // кол-во
        entryNumber: { type: Number },                     // цена за штуку
        deliveryCost: { type: Number },                // сумма по позиции
        quantity: { type: Number },                 // id товара
        weight: { type: Number },              // ссылка на товар
        basePrice: { type: Number },
        totalPrice: { type: Number },
        unitType: { type: String },
        category: {
            code: { type: String },
            title: { type: String },
        },
        offer: {
            code: { type: String },
            name: { type: String },
        },
        isImeiRequired: { type: Boolean },
        product: {
            id: { type: String },
            type:{ type: String },
            link: { type: String },
        },
        deliveryPointOfService: {
            id: { type: String },
            type: { type: String },
            link: { type: String },
        }
    },
    { _id: false } // не создаём отдельные _id для поддокументов
);

const OrderSchema = new Schema<IOrder>(
    {
        kmId: { type: String, required: true, unique: true, index: true },
        code: { type: String },    // код заказа
        type: { type: String },    // код заказа
        creationDate: { type: Number, required: false },    // дата заказа
        totalPrice: { type: Number, required: false },   // сумма заказа
        deliveryCostForSeller: { type: Number, required: false },    // сумма за доставку
        isKaspiDelivery: { type: Boolean, default: false },   // Доставка каспи?
        preOrder: { type: Boolean, required: false },    // -
        approvedByBankDate: { type: Number, required: false },    // дата одобрения банка
        signatureRequired: { type: Boolean, default: false },    // нужна ли подпись
        status: { type: String },    // статус заказа
        pickupPointId: { type: String },   // -
        state: { type: String },    // Состояние заказа
        deliveryCost: { type: Number },   // Состояние заказа

        // Данные Клиента
        customer: {
            id: { type: String },
            name: { type: String },
            cellPhone: { type: String },
            firstName: { type: String },
            lastName: { type: String },
        },

        // Адрес доставки
        deliveryAddress: {
            streetName: { type: String },
            streetNumber: { type: String },
            town: { type: String },
            formattedAddress: { type: String },
            district: {type: Schema.Types.Mixed},
            building: {type: Schema.Types.Mixed},
            apartment: {type: Schema.Types.Mixed},
            latitude: {type: Schema.Types.Mixed},
            longitude: {type: Schema.Types.Mixed}
        },

        // Адрес отгрузки
        originAddress: {
            id: { type: String },
            displayName: { type: String },
            address: {
                streetName: { type: String },
                streetNumber: { type: String },
                town: { type: String },
                district: {type: Schema.Types.Mixed},
                building: { type: String },
                apartment: {type: Schema.Types.Mixed},
                formattedAddress: { type: String },
                latitude: { type: Number },
                longitude: { type: Number },
            },
            city: {
                id: { type: String },
                code: { type: String },
                name: { type: String },
                active: { type: Boolean, default: false },
            }
        },

        // Каспи доставка
        kaspiDelivery: {
            waybill: { type: String },
            courierTransmissionDate: { type: Number },
            courierTransmissionPlanningDate: { type: Number },
            waybillNumber: { type: String },
            express: { type: Boolean, default: false },
            returnedToWarehouse: { type: Boolean, default: false },
            firstMileCourier: {type: Schema.Types.Mixed}
        },

        assembled: { type: Boolean, default: false },
        creditTerm: { type: Number },
        deliveryMode: { type: String },
        paymentMode: { type: String },
        objects: [OrderObjectSchema],
    },
    { timestamps: true, versionKey: false }
);

// Удобная проекция при отдаче наружу
OrderSchema.set("toJSON", {
    transform: (_doc, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        // цены можно конвертировать в KZT для API (если нужно):
        // ret.purchasePriceKzt = ret.purchasePrice != null ? ret.purchasePrice / 100 : null;
        // ret.kaspiPriceKzt = ret.kaspiPrice != null ? ret.kaspiPrice / 100 : null;
        return ret;
    },
});

export const Order = model<IOrder>("Order", OrderSchema);
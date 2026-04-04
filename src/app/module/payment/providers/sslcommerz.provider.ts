import status from "http-status";
import { envVars } from "../../../../config/env";
import AppError from "../../../errorHelpers/AppError";

const SSLCOMMERZ_SANDBOX_BASE_URL = "https://sandbox.sslcommerz.com";
const SSLCOMMERZ_LIVE_BASE_URL = "https://securepay.sslcommerz.com";

type TSslCommerzHostedSessionInput = {
    tranId: string;
    amount: number;
    currency: string;
    successUrl: string;
    failUrl: string;
    cancelUrl: string;
    ipnUrl: string;
    customer: {
        name: string;
        email: string;
        phone: string;
    };
    product: {
        name: string;
        category: string;
        profile: string;
    };
    metadata: {
        valueA?: string;
        valueB?: string;
        valueC?: string;
        valueD?: string;
    };
    emiOption?: 0 | 1;
    multiCardName?: string;
};

type TSslCommerzHostedSessionResponse = {
    status?: string;
    failedreason?: string;
    sessionkey?: string;
    GatewayPageURL?: string;
    redirectGatewayURL?: string;
    [key: string]: unknown;
};

type TSslCommerzValidationRecord = {
    APIConnect?: string;
    status?: string;
    tran_id?: string;
    val_id?: string;
    amount?: string;
    currency?: string;
    currency_amount?: string;
    currency_type?: string;
    sessionkey?: string;
    bank_tran_id?: string;
    card_type?: string;
    risk_level?: string;
    risk_title?: string;
    store_amount?: string;
    error?: string;
    validated_on?: string;
    value_a?: string;
    value_b?: string;
    value_c?: string;
    value_d?: string;
    [key: string]: unknown;
};

type TSslCommerzValidationResponse = TSslCommerzValidationRecord & {
    element?: TSslCommerzValidationRecord[];
};

const getSslCommerzBaseUrl = () =>
    envVars.SSLCOMMERZ_IS_SANDBOX
        ? SSLCOMMERZ_SANDBOX_BASE_URL
        : SSLCOMMERZ_LIVE_BASE_URL;

const getSslCommerzCredentialsOrThrow = () => {
    if (!envVars.SSLCOMMERZ_STORE_ID || !envVars.SSLCOMMERZ_STORE_PASSWORD) {
        throw new AppError(
            status.INTERNAL_SERVER_ERROR,
            "SSLCOMMERZ payment credentials are not configured.",
        );
    }

    return {
        storeId: envVars.SSLCOMMERZ_STORE_ID,
        storePassword: envVars.SSLCOMMERZ_STORE_PASSWORD,
    };
};

const parseJsonResponse = async <TResponse>(
    response: Response,
): Promise<TResponse> => {
    const rawResponse = await response.text();

    try {
        return JSON.parse(rawResponse) as TResponse;
    } catch {
        throw new AppError(
            status.BAD_GATEWAY,
            "SSLCOMMERZ returned an invalid response payload.",
        );
    }
};

const getGatewayRedirectUrl = (
    payload: TSslCommerzHostedSessionResponse,
): string | undefined => {
    const gatewayPageUrl =
        typeof payload.GatewayPageURL === "string" && payload.GatewayPageURL.trim()
            ? payload.GatewayPageURL.trim()
            : undefined;

    if (gatewayPageUrl) {
        return gatewayPageUrl;
    }

    const redirectGatewayUrl =
        typeof payload.redirectGatewayURL === "string" &&
        payload.redirectGatewayURL.trim()
            ? payload.redirectGatewayURL.trim()
            : undefined;

    return redirectGatewayUrl;
};

const createHostedSession = async (
    input: TSslCommerzHostedSessionInput,
): Promise<TSslCommerzHostedSessionResponse> => {
    const { storeId, storePassword } = getSslCommerzCredentialsOrThrow();
    const initiationUrl = `${getSslCommerzBaseUrl()}/gwprocess/v4/api.php`;
    const requestBody = new URLSearchParams({
        store_id: storeId,
        store_passwd: storePassword,
        total_amount: input.amount.toFixed(2),
        currency: input.currency,
        format: "json",
        v: "1",
        tran_id: input.tranId,
        success_url: input.successUrl,
        fail_url: input.failUrl,
        cancel_url: input.cancelUrl,
        ipn_url: input.ipnUrl,
        cus_name: input.customer.name,
        cus_email: input.customer.email,
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: input.customer.phone,
        cus_fax: input.customer.phone,
        shipping_method: "NO",
        num_of_item: "1",
        ship_name: input.customer.name,
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: "1000",
        ship_country: "Bangladesh",
        product_name: input.product.name,
        product_category: input.product.category,
        product_profile: input.product.profile,
        emi_option: String(input.emiOption ?? 0),
        multi_card_name:
            input.multiCardName?.trim() || "visacard,mastercard,amexcard",
        value_a: input.metadata.valueA ?? "",
        value_b: input.metadata.valueB ?? "",
        value_c: input.metadata.valueC ?? "",
        value_d: input.metadata.valueD ?? "",
    });

    console.info("SSLCommerz init request", {
        initiationUrl,
        storeId,
        total_amount: input.amount.toFixed(2),
        currency: input.currency,
        tran_id: input.tranId,
        success_url: input.successUrl,
        fail_url: input.failUrl,
        cancel_url: input.cancelUrl,
        ipn_url: input.ipnUrl,
        cus_name: input.customer.name,
        cus_email: input.customer.email,
        cus_phone: input.customer.phone,
        product_name: input.product.name,
        product_category: input.product.category,
        product_profile: input.product.profile,
        emi_option: String(input.emiOption ?? 0),
        multi_card_name:
            input.multiCardName?.trim() || "visacard,mastercard,amexcard",
    });

    let response: Response;

    try {
        response = await fetch(initiationUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: requestBody.toString(),
        });
    } catch {
        throw new AppError(
            status.BAD_GATEWAY,
            "Unable to connect to SSLCOMMERZ to start the payment session.",
        );
    }

    if (!response.ok) {
        throw new AppError(
            status.BAD_GATEWAY,
            "SSLCOMMERZ rejected the payment initiation request.",
        );
    }

    const payload =
        await parseJsonResponse<TSslCommerzHostedSessionResponse>(response);

    console.info("SSLCommerz init response", {
        status: payload.status,
        failedreason: payload.failedreason,
        sessionkey: payload.sessionkey,
        GatewayPageURL: payload.GatewayPageURL,
        redirectGatewayURL: payload.redirectGatewayURL,
    });

    const apiStatus =
        typeof payload.status === "string" ? payload.status.toUpperCase() : "";
    const redirectUrl = getGatewayRedirectUrl(payload);

    if (apiStatus !== "SUCCESS" || !redirectUrl) {
        throw new AppError(
            status.BAD_GATEWAY,
            typeof payload.failedreason === "string" && payload.failedreason.trim()
                ? payload.failedreason
                : "SSLCOMMERZ could not create a hosted checkout session.",
        );
    }

    return payload;
};

const extractValidationRecord = (
    payload: TSslCommerzValidationResponse,
    tranId: string,
): TSslCommerzValidationRecord => {
    if (Array.isArray(payload.element) && payload.element.length > 0) {
        return (
            payload.element.find(
                (record) => typeof record.tran_id === "string" && record.tran_id === tranId,
            ) ?? payload.element[0]
        );
    }

    return payload;
};

const queryTransactionByTranId = async (
    tranId: string,
): Promise<TSslCommerzValidationRecord> => {
    const { storeId, storePassword } = getSslCommerzCredentialsOrThrow();
    const queryUrl = new URL(
        `${getSslCommerzBaseUrl()}/validator/api/merchantTransIDvalidationAPI.php`,
    );
    queryUrl.searchParams.set("tran_id", tranId);
    queryUrl.searchParams.set("store_id", storeId);
    queryUrl.searchParams.set("store_passwd", storePassword);
    queryUrl.searchParams.set("v", "1");
    queryUrl.searchParams.set("format", "json");

    let response: Response;

    try {
        response = await fetch(queryUrl, {
            method: "GET",
        });
    } catch {
        throw new AppError(
            status.BAD_GATEWAY,
            "Unable to connect to SSLCOMMERZ to verify the payment.",
        );
    }

    if (!response.ok) {
        throw new AppError(
            status.BAD_GATEWAY,
            "SSLCOMMERZ rejected the payment verification request.",
        );
    }

    const payload = await parseJsonResponse<TSslCommerzValidationResponse>(response);
    const record = extractValidationRecord(payload, tranId);
    const apiConnect =
        typeof record.APIConnect === "string"
            ? record.APIConnect.toUpperCase()
            : typeof payload.APIConnect === "string"
              ? payload.APIConnect.toUpperCase()
              : "";

    if (apiConnect && apiConnect !== "DONE") {
        throw new AppError(
            status.BAD_GATEWAY,
            "SSLCOMMERZ could not verify the payment right now.",
        );
    }

    return {
        ...record,
        APIConnect: apiConnect || record.APIConnect,
    };
};

const queryTransactionByValidationId = async (
    validationId: string,
): Promise<TSslCommerzValidationRecord> => {
    const { storeId, storePassword } = getSslCommerzCredentialsOrThrow();
    const queryUrl = new URL(
        `${getSslCommerzBaseUrl()}/validator/api/validationserverAPI.php`,
    );
    queryUrl.searchParams.set("val_id", validationId);
    queryUrl.searchParams.set("store_id", storeId);
    queryUrl.searchParams.set("store_passwd", storePassword);
    queryUrl.searchParams.set("v", "1");
    queryUrl.searchParams.set("format", "json");

    let response: Response;

    try {
        response = await fetch(queryUrl, {
            method: "GET",
        });
    } catch {
        throw new AppError(
            status.BAD_GATEWAY,
            "Unable to connect to SSLCOMMERZ to verify the payment.",
        );
    }

    if (!response.ok) {
        throw new AppError(
            status.BAD_GATEWAY,
            "SSLCOMMERZ rejected the payment verification request.",
        );
    }

    const payload = await parseJsonResponse<TSslCommerzValidationResponse>(response);
    const record = extractValidationRecord(payload, "");
    const apiConnect =
        typeof record.APIConnect === "string"
            ? record.APIConnect.toUpperCase()
            : typeof payload.APIConnect === "string"
              ? payload.APIConnect.toUpperCase()
              : "";

    if (apiConnect && apiConnect !== "DONE") {
        throw new AppError(
            status.BAD_GATEWAY,
            "SSLCOMMERZ could not verify the payment right now.",
        );
    }

    return {
        ...record,
        APIConnect: apiConnect || record.APIConnect,
    };
};

export type {
    TSslCommerzHostedSessionInput,
    TSslCommerzHostedSessionResponse,
    TSslCommerzValidationRecord,
};

export const sslCommerzProvider = {
    createHostedSession,
    getGatewayRedirectUrl,
    queryTransactionByValidationId,
    queryTransactionByTranId,
};

import axios from "axios";
import { API_BASE_URL, getTenantId } from "../config";

const PAYMENT_URL = `${API_BASE_URL}/api/payments`;

function getAuthHeader() {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Unauthorized");
  return {
    Authorization: `Bearer ${token}`,
    "x-tenant-id": getTenantId(),
  };
}

export interface RazorpayCreatePaymentResponse {
  provider: "RAZORPAY";
  razorpay_order_id: string;
  amount: number;
  currency: string;
  /** Vendor Razorpay key — public Key ID only. */
  key_id?: string;
}

export interface CashfreeCreatePaymentResponse {
  provider: "CASHFREE";
  payment_session_id?: string;
  cashfree_order_id: string;
  amount: number;
  currency: string;
  environment: "sandbox" | "production";
  payment_status?: "SUCCESS" | "PENDING" | "FAILED";
}

export type CreatePaymentResponse =
  | RazorpayCreatePaymentResponse
  | CashfreeCreatePaymentResponse;

export interface VerifyPaymentPayload {
  order_id: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  status?: "SUCCESS" | "PENDING" | "FAILED";
  message?: string;
}

export async function createPaymentOrder(orderId: string): Promise<CreatePaymentResponse> {
  const res = await axios.post(
    `${PAYMENT_URL}/create`,
    { order_id: orderId },
    { headers: getAuthHeader() }
  );
  return res.data;
}

export async function abandonUnpaidOrder(orderId: string): Promise<void> {
  try {
    await axios.post(
      `${PAYMENT_URL}/abandon`,
      { order_id: orderId },
      { headers: getAuthHeader() }
    );
  } catch (err) {
    console.error("Unable to cancel unpaid order", err);
  }
}

export async function verifyPayment(payload: VerifyPaymentPayload): Promise<VerifyPaymentResponse> {
  const res = await axios.post(`${PAYMENT_URL}/verify`, payload, {
    headers: getAuthHeader(),
  });
  return res.data;
}

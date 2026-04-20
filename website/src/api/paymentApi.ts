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

export interface CreatePaymentResponse {
  razorpay_order_id: string;
  amount: number;
  currency: string;
}

export interface VerifyPaymentPayload {
  order_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export async function createPaymentOrder(orderId: string): Promise<CreatePaymentResponse> {
  const res = await axios.post(
    `${PAYMENT_URL}/create`,
    { order_id: orderId },
    { headers: getAuthHeader() }
  );
  return res.data;
}

export async function verifyPayment(payload: VerifyPaymentPayload): Promise<{ success: boolean }> {
  const res = await axios.post(`${PAYMENT_URL}/verify`, payload, {
    headers: getAuthHeader(),
  });
  return res.data;
}

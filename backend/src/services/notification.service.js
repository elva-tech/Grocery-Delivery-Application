const Notification = require("../models/Notification.model");

const createOrderStatusNotification = async ({
  tenantId,   
  userId,
  orderId,
  status
}) => {
  const message = `Your order has been ${status}`;

  return await Notification.create({
    tenantId,   
    userId,
    orderId,
    message,
    status,
    type: "ORDER_STATUS",
    isRead: false
  });
};

module.exports = {
  createOrderStatusNotification
};

const POST_STATUSES = {
    OPEN: 'open',
    HOLD: 'hold',
    CLOSED: 'closed',
};

const ORDER_STATUSES = {
    ACTIVE: 'active',
    CANCELED: 'canceled',
    COMPLETED: 'completed',
};

const ORDER_STATES = {
    IS_APPROVED: 'isApproved',
    IS_PAID: 'isPaid',
    IS_DELIVERED: 'isDelivered',
    IS_SOLD: 'isSold',
    IS_PAYMENT_RECEIVED: 'isPaymentReceived',
};

module.exports = {
    POST_STATUSES,
    ORDER_STATUSES,
    ORDER_STATES
};

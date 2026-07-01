function formatUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    logon: user.logon,
    email: user.email,
    role: user.role,
  };
}

function formatOrder(order) {
  if (!order) return null;

  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    applicant: order.applicant,
    caseNumber: order.caseNumber,
    facility: order.facility,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function formatProvider(provider) {
  if (!provider) return null;

  return {
    id: provider.id,
    companyName: provider.companyName,
    address: provider.address,
    zipCode: provider.zipCode,
    city: provider.city,
    state: provider.state,
    phone: provider.phone,
    fax: provider.fax,
    email: provider.email,
  };
}

function formatFacility(facility) {
  if (!facility) return null;

  return {
    id: facility.id,
    name: facility.name,
    address: facility.address,
    phone: facility.phone,
    email: facility.email,
  };
}

function formatEmployee(employee) {
  if (!employee) return null;

  return {
    id: employee.id,
    name: employee.name,
    logon: employee.logon,
    email: employee.email,
    role: employee.role,
    lastLogin: employee.lastLogin || "Never",
    terminated: Boolean(employee.terminated ?? employee.is_terminated),
    suspended: Boolean(employee.suspended ?? employee.is_suspended),
    reactivatedDate: employee.reactivatedDate || null,
  };
}

function formatInvoice(invoice) {
  if (!invoice) return null;

  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    orderId: invoice.orderId,
    amount: invoice.amount,
    due: invoice.due,
    status: invoice.status,
  };
}

function formatActivityLog(entry) {
  if (!entry) return null;

  return {
    id: entry.id,
    date: entry.date,
    by: entry.by,
    action: entry.action,
    note: entry.note,
  };
}

function formatNotification(notification) {
  if (!notification) return null;

  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    read: notification.read,
    createdAt: notification.createdAt,
  };
}

module.exports = {
  formatUser,
  formatOrder,
  formatProvider,
  formatFacility,
  formatEmployee,
  formatInvoice,
  formatActivityLog,
  formatNotification,
};

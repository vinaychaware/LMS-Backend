const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  courseId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'courses',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: { args: [0], msg: 'Amount cannot be negative' }
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD',
    allowNull: false,
    validate: {
      isIn: { args: [['USD', 'EUR', 'GBP', 'CAD', 'AUD']], msg: 'Invalid currency' }
    }
  },
  method: {
    type: DataTypes.ENUM('stripe', 'paypal', 'bank_transfer', 'crypto', 'other'),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Payment method is required' }
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'),
    defaultValue: 'pending',
    allowNull: false
  },
  transactionId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true
  },
  externalPaymentId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  paymentIntentId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  refundId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  billingDetails: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  paymentMethod: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  fees: {
    type: DataTypes.JSON,
    defaultValue: {
      amount: 0,
      currency: 'USD'
    }
  },
  refund: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  error: {
    type: DataTypes.JSON,
    allowNull: true
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isRecurring: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  recurringInterval: {
    type: DataTypes.ENUM('monthly', 'quarterly', 'yearly'),
    allowNull: true
  },
  nextBillingDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  subscriptionId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  invoiceUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isUrl: { msg: 'Please provide a valid invoice URL' }
    }
  },
  receiptUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isUrl: { msg: 'Please provide a valid receipt URL' }
    }
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'payments',
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['courseId']
    },
    {
      fields: ['status']
    },
    {
      fields: ['method']
    },
    {
      fields: ['transactionId']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// Instance methods
Payment.prototype.getFormattedAmount = function() {
  return `${this.currency} ${this.amount}`;
};

Payment.prototype.isSuccessful = function() {
  return this.status === 'completed';
};

Payment.prototype.isPending = function() {
  return this.status === 'pending' || this.status === 'processing';
};

Payment.prototype.isFailed = function() {
  return this.status === 'failed' || this.status === 'cancelled';
};

Payment.prototype.canRefund = function() {
  return this.status === 'completed' && !this.refund.amount;
};

Payment.prototype.getRefundAmount = function() {
  if (this.refund && this.refund.amount) {
    return this.refund.amount;
  }
  return 0;
};

Payment.prototype.isExpired = function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

Payment.prototype.updateStatus = function(newStatus, additionalData = {}) {
  this.status = newStatus;
  
  if (newStatus === 'completed') {
    this.processedAt = new Date();
  }
  
  if (newStatus === 'failed' && additionalData.error) {
    this.error = additionalData.error;
  }
  
  if (newStatus === 'refunded' && additionalData.refund) {
    this.refund = { ...this.refund, ...additionalData.refund };
  }
  
  return this.save();
};

// Class methods
Payment.findByUser = function(userId) {
  return this.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']]
  });
};

Payment.findByCourse = function(courseId) {
  return this.findAll({
    where: { courseId },
    order: [['createdAt', 'DESC']]
  });
};

Payment.findByStatus = function(status) {
  return this.findAll({
    where: { status },
    order: [['createdAt', 'DESC']]
  });
};

Payment.findByMethod = function(method) {
  return this.findAll({
    where: { method },
    order: [['createdAt', 'DESC']]
  });
};

Payment.findSuccessful = function() {
  return this.findAll({
    where: { status: 'completed' },
    order: [['processedAt', 'DESC']]
  });
};

Payment.findPending = function() {
  return this.findAll({
    where: { status: ['pending', 'processing'] },
    order: [['createdAt', 'ASC']]
  });
};

Payment.findFailed = function() {
  return this.findAll({
    where: { status: ['failed', 'cancelled'] },
    order: [['createdAt', 'DESC']]
  });
};

Payment.findExpired = function() {
  return this.findAll({
    where: {
      status: 'pending',
      expiresAt: { [sequelize.Op.lt]: new Date() }
    }
  });
};

Payment.getRevenueStats = function(startDate = null, endDate = null) {
  const whereClause = { status: 'completed' };
  
  if (startDate && endDate) {
    whereClause.processedAt = {
      [sequelize.Op.between]: [startDate, endDate]
    };
  }
  
  return this.findAll({
    where: whereClause,
    attributes: [
      'currency',
      [sequelize.fn('SUM', sequelize.col('amount')), 'totalRevenue'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalPayments'],
      [sequelize.fn('AVG', sequelize.col('amount')), 'averageAmount']
    ],
    group: ['currency']
  });
};

Payment.getMethodStats = function() {
  return this.findAll({
    attributes: [
      'method',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']
    ],
    where: { status: 'completed' },
    group: ['method']
  });
};

Payment.search = function(query) {
  return this.findAll({
    where: {
      [sequelize.Op.or]: [
        { transactionId: { [sequelize.Op.iLike]: `%${query}%` } },
        { externalPaymentId: { [sequelize.Op.iLike]: `%${query}%` } },
        { description: { [sequelize.Op.iLike]: `%${query}%` } }
      ]
    },
    order: [['createdAt', 'DESC']]
  });
};

module.exports = Payment;

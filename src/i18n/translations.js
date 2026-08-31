// STAGE 30 — Arabic / English translation dictionary for the customer-facing
// storefront. This project had no i18n library installed (checked:
// react-i18next / i18next / any `t(...)` usage — none existed; src/utils/rtl.js
// was an empty "TODO Stage 4" stub). Per the stage brief ("use the simplest
// maintainable approach appropriate for this project... do not create an
// unnecessarily complex localization architecture"), this is a plain flat
// key -> { ar, en } dictionary plus a tiny t() lookup (see LanguageContext.jsx)
// rather than pulling in a new dependency.
//
// Scope: customer-facing UI strings only (Admin Portal is out of scope for
// this stage). Business data (product names, category names, customer
// addresses, order snapshots) is NOT here — those are stored, not UI copy,
// and the stage brief explicitly excludes them.
//
// Keys are grouped by area for maintainability. Add new keys here, never
// hardcode new Arabic/English UI strings directly in a component.

const translations = {
  // ---------------------------------------------------------------------
  // Common / shared
  // ---------------------------------------------------------------------
  'common.loading': { ar: 'جار التحميل...', en: 'Loading...' },
  'common.error': { ar: 'حدث خطأ ما', en: 'Something went wrong' },
  'common.retry': { ar: 'اعادة المحاولة', en: 'Retry' },
  'common.save': { ar: 'حفظ', en: 'Save' },
  'common.cancel': { ar: 'الغاء', en: 'Cancel' },
  'common.back': { ar: 'رجوع', en: 'Back' },
  'common.currency': { ar: 'د.ك', en: 'KWD' },
  'common.viewAll': { ar: 'عرض الكل', en: 'View all' },

  // ---------------------------------------------------------------------
  // Navbar
  // ---------------------------------------------------------------------
  'nav.home': { ar: 'الرئيسية', en: 'Home' },
  'nav.account': { ar: 'الحساب', en: 'Account' },
  'nav.myOrders': { ar: 'طلباتي', en: 'My Orders' },
  'nav.logout': { ar: 'تسجيل الخروج', en: 'Log out' },
  'nav.login': { ar: 'تسجيل الدخول', en: 'Log in' },
  'nav.cart': { ar: 'السلة', en: 'Cart' },
  'nav.openMenu': { ar: 'فتح القائمة', en: 'Open menu' },
  'nav.closeMenu': { ar: 'اغلاق القائمة', en: 'Close menu' },
  'nav.language': { ar: 'اللغة', en: 'Language' },

  // ---------------------------------------------------------------------
  // Homepage
  // ---------------------------------------------------------------------
  'home.heroDefaultMessage': {
    ar: 'ملابس داخلية عصرية بجودة عالية وتصميم يليق بك',
    en: 'Modern, high-quality underwear designed for you',
  },
  'home.shopNow': { ar: 'تسوق الان', en: 'Shop now' },
  'home.shopByCategory': { ar: 'تسوق حسب التصنيف', en: 'Shop by category' },
  'home.featuredProducts': { ar: 'منتجات مميزة', en: 'Featured products' },
  'home.bestSellers': { ar: 'الاكثر مبيعا', en: 'Best sellers' },
  'home.newArrivals': { ar: 'وصل حديثا', en: 'New arrivals' },
  'home.currentOffers': { ar: 'العروض الحالية', en: 'Current offers' },
  'home.productsLoadError': { ar: 'حدث خطا اثناء تحميل المنتجات', en: 'Failed to load products' },
  'home.noFeaturedProducts': { ar: 'لا توجد منتجات مميزة حاليا', en: 'No featured products right now' },
  'home.noProducts': { ar: 'لا توجد منتجات حاليا', en: 'No products right now' },
  'home.discountPrefix': { ar: 'خصم', en: 'Discount' },
  'home.onOrdersOverSuffix': { ar: 'على طلبات {amount} فأكثر', en: 'on orders over {amount}' },

  // ---------------------------------------------------------------------
  // Category
  // ---------------------------------------------------------------------
  'category.shopNow': { ar: 'تسوق الان', en: 'Shop now' },
  'category.loadError': { ar: 'حدث خطأ أثناء تحميل التصنيف', en: 'Failed to load category' },
  'category.noProducts': { ar: 'لا توجد منتجات في هذا التصنيف حاليا', en: 'No products in this category right now' },

  // ---------------------------------------------------------------------
  // Product
  // ---------------------------------------------------------------------
  'product.addToCart': { ar: 'اضافة الى السلة', en: 'Add to cart' },
  'product.addedToCart': { ar: 'تمت الإضافة الى السلة', en: 'Added to cart' },
  'product.outOfStock': { ar: 'غير متوفر حاليا', en: 'Currently unavailable' },
  'product.availableCount': { ar: 'متوفر ({count} قطعة)', en: 'In stock ({count} left)' },
  'product.quantity': { ar: 'الكمية', en: 'Quantity' },
  'product.notFound': { ar: 'المنتج غير موجود', en: 'Product not found' },
  'product.loadError': { ar: 'حدث خطأ أثناء تحميل المنتج', en: 'Failed to load the product' },
  'product.color': { ar: 'اللون', en: 'Color' },
  'product.size': { ar: 'المقاس', en: 'Size' },
  'product.material': { ar: 'الخامة', en: 'Material' },
  'product.viewImage': { ar: 'عرض هذه الصورة', en: 'View this image' },
  'product.description': { ar: 'الوصف', en: 'Description' },

  // ---------------------------------------------------------------------
  // Cart
  // ---------------------------------------------------------------------
  'cart.title': { ar: 'سلة التسوق', en: 'Shopping cart' },
  'cart.empty': { ar: 'السلة فارغة', en: 'Your cart is empty' },
  'cart.emptyHint': { ar: 'لم تقم بإضافة أي منتجات إلى السلة بعد', en: "You haven't added any products to your cart yet" },
  'cart.browseProducts': { ar: 'تصفح المنتجات', en: 'Browse products' },
  'cart.continueShopping': { ar: 'متابعة التسوق', en: 'Continue shopping' },
  'cart.remove': { ar: 'ازالة', en: 'Remove' },
  'cart.removeFromCart': { ar: 'إزالة من السلة', en: 'Remove from cart' },
  'cart.decreaseQty': { ar: 'تقليل الكمية', en: 'Decrease quantity' },
  'cart.increaseQty': { ar: 'زيادة الكمية', en: 'Increase quantity' },
  'cart.subtotal': { ar: 'الإجمالي الفرعي', en: 'Subtotal' },
  'cart.shippingNote': { ar: 'يتم احتساب الشحن والخصومات عند إتمام الطلب', en: 'Shipping and discounts are calculated at checkout' },
  'cart.checkout': { ar: 'اتمام الطلب', en: 'Checkout' },
  'cart.orderSummary': { ar: 'ملخص الطلب', en: 'Order summary' },

  // ---------------------------------------------------------------------
  // Checkout
  // ---------------------------------------------------------------------
  'checkout.title': { ar: 'اتمام الطلب', en: 'Checkout' },
  'checkout.emptyCartHint': { ar: 'لا يمكن إتمام الطلب بدون منتجات في السلة', en: 'You need items in your cart to check out' },
  'checkout.shippingInfo': { ar: 'بيانات التوصيل', en: 'Delivery information' },
  'checkout.paymentMethod': { ar: 'طريقة الدفع', en: 'Payment method' },
  'checkout.orderSummary': { ar: 'ملخص الطلب', en: 'Order summary' },
  'checkout.subtotal': { ar: 'المجموع الفرعي', en: 'Subtotal' },
  'checkout.shipping': { ar: 'الشحن', en: 'Shipping' },
  'checkout.discount': { ar: 'الخصم', en: 'Discount' },
  'checkout.total': { ar: 'الاجمالي', en: 'Total' },
  'checkout.placeOrder': { ar: 'تأكيد الطلب', en: 'Place order' },
  'checkout.freeShipping': { ar: 'مجاني', en: 'Free' },
  'checkout.cashOnDelivery': { ar: 'الدفع عند الاستلام', en: 'Cash on delivery' },
  'checkout.creatingOrder': { ar: 'جاري إنشاء الطلب...', en: 'Placing your order...' },
  'checkout.continueToPayment': { ar: 'المتابعة للدفع', en: 'Continue to payment' },
  'checkout.moreItemsForFreeShipping': {
    ar: 'اطلب {count} {unit} للحصول على شحن مجاني',
    en: 'Add {count} more {unit} for free shipping',
  },
  'checkout.moreAmountForFreeShipping': {
    ar: 'باقي {amount} للحصول على شحن مجاني',
    en: '{amount} more for free shipping',
  },
  'checkout.extraPieceSingular': { ar: 'قطعة اضافية', en: 'item' },
  'checkout.extraPiecePlural': { ar: 'قطع اضافية', en: 'items' },
  'checkout.fullName': { ar: 'الاسم الكامل', en: 'Full name' },
  'checkout.phone': { ar: 'رقم الهاتف', en: 'Phone number' },
  'checkout.emailOptional': { ar: 'البريد الالكتروني (اختياري)', en: 'Email (optional)' },
  'checkout.address': { ar: 'العنوان', en: 'Address' },
  'checkout.addressPlaceholder': { ar: 'الشارع، رقم المبنى، الشقة، علامة مميزة', en: 'Street, building no., apartment, landmark' },
  'checkout.city': { ar: 'المدينة', en: 'City' },
  'checkout.governorate': { ar: 'المحافظة', en: 'Governorate' },
  'checkout.chooseGovernorate': { ar: 'اختر المحافظة', en: 'Choose governorate' },
  'checkout.notesOptional': { ar: 'ملاحظات إضافية (اختياري)', en: 'Additional notes (optional)' },
  'checkout.notesPlaceholder': { ar: 'اي تفاصيل إضافية تساعد في توصيل طلبك', en: 'Any extra details that help deliver your order' },
  'checkout.onlinePayment': { ar: 'الدفع الإلكتروني', en: 'Online payment' },
  'checkout.discountCode': { ar: 'كود الخصم', en: 'Discount code' },
  'checkout.discountApplied': { ar: 'تم تطبيق الخصم', en: 'Discount applied' },
  'checkout.removeDiscountCode': { ar: 'إزالة كود الخصم', en: 'Remove discount code' },
  'checkout.apply': { ar: 'تطبيق', en: 'Apply' },
  'checkout.itemUnavailable': { ar: 'غير متوفر حاليا', en: 'Currently unavailable' },
  'checkout.itemNotReadyHint': { ar: 'احد المنتجات غير جاهز للطلب حاليا، برجاء إزالته من السلة او التواصل معنا', en: 'One of the products is not ready to order — please remove it from your cart or contact us' },
  'checkout.cartLoadError': { ar: 'تعذر تحميل بيانات السلة، برجاء المحاولة مرة اخرى', en: 'Failed to load your cart — please try again' },
  'checkout.discountInvalid': { ar: 'كود الخصم غير صالح', en: 'Invalid discount code' },
  'checkout.discountVerifyError': { ar: 'تعذر التحقق من كود الخصم، برجاء المحاولة مرة اخرى', en: 'Failed to verify the discount code — please try again' },
  'checkout.cartChangedError': { ar: 'تغيرت بيانات بعض المنتجات في السلة، برجاء مراجعة الطلب قبل المتابعة', en: 'Some products in your cart have changed — please review your order before continuing' },
  'checkout.noValidItemsError': { ar: 'لا توجد منتجات صالحة للطلب في السلة', en: 'There are no valid products to order in your cart' },
  'checkout.itemNotReadyError': { ar: 'احد المنتجات في السلة غير جاهز للطلب حاليا، برجاء التواصل معنا او إزالته من السلة', en: 'One of the products in your cart is not ready to order — please contact us or remove it from your cart' },
  'checkout.discountNoLongerValid': { ar: 'لم يعد كود الخصم صالحا وتم إزالته، برجاء مراجعة الطلب والمحاولة مرة اخرى', en: 'The discount code is no longer valid and was removed — please review your order and try again' },
  'checkout.stockRanOut': { ar: 'عذرًا، نفذت الكمية المتاحة من احد المنتجات قبل إتمام طلبك، برجاء مراجعة السلة والمحاولة مرة اخرى', en: 'Sorry, one of the products sold out before your order was placed — please review your cart and try again' },
  'checkout.discountNoLongerAvailable': { ar: 'كود الخصم لم يعد متاحا، برجاء المحاولة مرة اخرى', en: 'The discount code is no longer available — please try again' },
  'checkout.createOrderError': { ar: 'حدث خطأ اثناء إنشاء الطلب، برجاء المحاولة مرة اخرى', en: 'An error occurred while creating your order — please try again' },
  'checkout.productUnavailableReason': { ar: 'هذا المنتج لم يعد متوفرا', en: 'This product is no longer available' },
  'checkout.variantUnavailableReason': { ar: 'اللون / المقاس المختار لم يعد متوفرا', en: 'The selected color/size is no longer available' },
  'checkout.insufficientStockReason': { ar: 'الكمية المطلوبة غير متوفرة في المخزون حاليا', en: 'The requested quantity is not currently in stock' },
  'checkout.discountNotFound': { ar: 'كود الخصم غير صحيح', en: 'Invalid discount code' },
  'checkout.discountNotStarted': { ar: 'كود الخصم غير مفعل بعد', en: 'This discount code is not active yet' },
  'checkout.discountExpired': { ar: 'انتهت صلاحية كود الخصم', en: 'This discount code has expired' },
  'checkout.discountUsageLimitReached': { ar: 'تم استخدام كود الخصم بالكامل', en: 'This discount code has reached its usage limit' },
  'checkout.discountMinOrderNotMet': { ar: 'الحد الادنى للطلب غير متحقق لاستخدام هذا الكود', en: 'The minimum order amount for this code has not been met' },

  // ---------------------------------------------------------------------
  // Auth (login / register)
  // ---------------------------------------------------------------------
  'auth.login': { ar: 'تسجيل الدخول', en: 'Log in' },
  'auth.register': { ar: 'انشاء حساب', en: 'Create account' },
  'auth.email': { ar: 'البريد الالكتروني', en: 'Email' },
  'auth.password': { ar: 'كلمة المرور', en: 'Password' },
  'auth.fullName': { ar: 'الاسم الكامل', en: 'Full name' },
  'auth.phone': { ar: 'رقم الهاتف', en: 'Phone number' },
  'auth.noAccount': { ar: 'ليس لديك حساب؟', en: "Don't have an account?" },
  'auth.haveAccount': { ar: 'لديك حساب بالفعل؟', en: 'Already have an account?' },
  'auth.joinAndShop': { ar: 'انضم الينا وابدأ التسوق', en: 'Join us and start shopping' },
  'auth.welcomeBack': { ar: 'مرحبا بعودتك', en: 'Welcome back' },
  'auth.loading': { ar: 'جار التحميل...', en: 'Loading...' },
  'auth.loggingIn': { ar: 'جاري تسجيل الدخول...', en: 'Logging in...' },
  'auth.registering': { ar: 'جاري انشاء الحساب...', en: 'Creating account...' },
  'auth.showPassword': { ar: 'اظهار كلمة المرور', en: 'Show password' },
  'auth.hidePassword': { ar: 'اخفاء كلمة المرور', en: 'Hide password' },
  'auth.emailRequired': { ar: 'البريد الالكتروني مطلوب', en: 'Email is required' },
  'auth.passwordRequired': { ar: 'كلمة المرور مطلوبة', en: 'Password is required' },
  'auth.invalidCredentials': { ar: 'البريد الالكتروني او كلمة المرور غير صحيحة', en: 'Incorrect email or password' },
  'auth.confirmPassword': { ar: 'تأكيد كلمة المرور', en: 'Confirm password' },
  'auth.fullNameRequired': { ar: 'الاسم الكامل مطلوب', en: 'Full name is required' },
  'auth.fullNameTooShort': { ar: 'الاسم الكامل قصير جدا', en: 'Full name is too short' },
  'auth.phoneRequired': { ar: 'رقم الهاتف مطلوب', en: 'Phone number is required' },
  'auth.phoneInvalid': { ar: 'رقم الهاتف غير صحيح', en: 'Invalid phone number' },
  'auth.emailInvalid': { ar: 'البريد الالكتروني غير صحيح', en: 'Invalid email address' },
  'auth.passwordTooShort': { ar: 'كلمة المرور يجب ان تكون {min} احرف على الاقل', en: 'Password must be at least {min} characters' },
  'auth.confirmPasswordRequired': { ar: 'تأكيد كلمة المرور مطلوب', en: 'Please confirm your password' },
  'auth.passwordsDoNotMatch': { ar: 'كلمتا المرور غير متطابقتين', en: "Passwords don't match" },
  'auth.emailAlreadyRegistered': { ar: 'هذا البريد الالكتروني مسجل بالفعل، جرب تسجيل الدخول', en: 'This email is already registered — try logging in' },
  'auth.weakPassword': { ar: 'كلمة المرور ضعيفة، يجب ان تكون {min} احرف على الاقل', en: 'Weak password — must be at least {min} characters' },
  'auth.signUpGenericError': { ar: 'تعذر انشاء الحساب، برجاء المحاولة مرة اخرى', en: 'Could not create the account — please try again' },
  'auth.accountCreated': { ar: 'تم انشاء الحساب بنجاح', en: 'Account created successfully' },
  'auth.confirmEmailHint': { ar: 'برجاء تاكيد بريدك الالكتروني من خلال الرسالة التي ارسلناها لك', en: 'Please confirm your email using the message we sent you' },
  'auth.goToLogin': { ar: 'الذهاب لتسجيل الدخول', en: 'Go to login' },

  // ---------------------------------------------------------------------
  // Account / My Orders
  // ---------------------------------------------------------------------
  'account.title': { ar: 'الحساب', en: 'Account' },
  'account.myOrders': { ar: 'طلباتي', en: 'My orders' },
  'account.myInfo': { ar: 'بياناتي', en: 'My information' },
  'account.name': { ar: 'الاسم', en: 'Name' },
  'account.memberSince': { ar: 'عضو منذ', en: 'Member since' },
  'account.noOrders': { ar: 'لا توجد طلبات بعد', en: 'No orders yet' },
  'account.orderDetails': { ar: 'تفاصيل الطلب', en: 'Order details' },
  'order.cancelled': { ar: 'تم إلغاء الطلب', en: 'Order cancelled' },
  'order.cancelledHint': { ar: 'لن يتم تجهيز أو شحن هذا الطلب', en: 'This order will not be prepared or shipped' },
  'order.currentStatus': { ar: 'حالة الطلب الحالية:', en: 'Current order status:' },
  'order.notFound': { ar: 'لم يتم العثور على الطلب', en: 'Order not found' },
  'order.notFoundHint': { ar: 'تأكد من رابط الطلب، او قد يكون هذا الطلب غير مرتبط بحسابك', en: "Check the order link, or this order may not be linked to your account" },
  'order.backToMyOrders': { ar: 'العودة لطلباتي', en: 'Back to my orders' },
  'order.copyNumber': { ar: 'نسخ الرقم', en: 'Copy number' },
  'order.copyOrderNumber': { ar: 'نسخ رقم الطلب', en: 'Copy order number' },
  'order.copied': { ar: 'تم النسخ', en: 'Copied' },
  'order.placedOn': { ar: 'تم الطلب في {date}', en: 'Placed on {date}' },
  'order.completeOrRetryPayment': { ar: 'إتمام / إعادة محاولة الدفع', en: 'Complete / retry payment' },
  'order.nextStep': { ar: 'الخطوة التالية: ', en: 'Next step: ' },
  'order.confirmCancel': { ar: 'هل أنت متأكد من إلغاء هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء', en: "Are you sure you want to cancel this order? This can't be undone" },
  'order.cancelSuccess': { ar: 'تم إلغاء طلبك بنجاح', en: 'Your order was cancelled successfully' },
  'order.cancelFailed': { ar: 'تعذر إلغاء الطلب، برجاء المحاولة مرة أخرى او التواصل معنا', en: 'Failed to cancel the order — please try again or contact us' },
  'order.cancelOrder': { ar: 'إلغاء الطلب', en: 'Cancel order' },
  'order.deliveryInfo': { ar: 'بيانات التوصيل', en: 'Delivery information' },
  'order.products': { ar: 'المنتجات', en: 'Products' },
  'order.discount': { ar: 'الخصم', en: 'Discount' },
  'order.shipping': { ar: 'الشحن', en: 'Shipping' },
  'order.freeShipping': { ar: 'مجاني', en: 'Free' },
  'order.reorder': { ar: 'إعادة الطلب', en: 'Reorder' },
  'order.reorderNoneAvailable': { ar: 'عذرًا، كل المنتجات في هذا الطلب لم تعد متاحة حاليًا', en: 'Sorry, none of the products in this order are available anymore' },
  'order.reorderPartial': {
    ar: 'تمت إضافة {added} منتج/منتجات للسلة. {unavailable} غير متاح حاليًا ولم تتم إضافته',
    en: '{added} item(s) added to your cart. {unavailable} unavailable and not added',
  },
  'order.insufficientStock': { ar: 'الكمية المتاحة الآن {count} فقط', en: 'Only {count} available now' },
  'order.variantUnavailable': { ar: 'هذا الخيار (اللون/المقاس) لم يعد متوفرًا', en: 'This option (color/size) is no longer available' },
  'order.productUnavailable': { ar: 'هذا المنتج لم يعد متوفرًا', en: 'This product is no longer available' },
  'order.currentlyUnavailable': { ar: 'غير متاح حاليًا', en: 'Currently unavailable' },
  'account.backToAccount': { ar: 'العودة للحساب', en: 'Back to account' },
  'account.ordersLoadError': { ar: 'تعذر تحميل الطلبات، برجاء المحاولة مرة اخرى', en: 'Failed to load orders — please try again' },
  'account.noOrdersYet': { ar: 'لا توجد طلبات حتى الآن', en: 'No orders yet' },
  'account.noOrdersHint': { ar: 'لم تقم بأي طلب بعد', en: "You haven't placed any orders yet" },
  'account.itemSingular': { ar: 'منتج', en: 'item' },
  'account.itemPlural': { ar: 'منتجات', en: 'items' },

  // ---------------------------------------------------------------------
  // Order success / payment
  // ---------------------------------------------------------------------
  'order.success': { ar: 'تم استلام طلبك بنجاح', en: 'Your order was placed successfully' },
  'order.thankYou': { ar: 'شكرا لك{name}، سنتواصل معك قريبا لتأكيد التوصيل', en: 'Thank you{name}, we will contact you soon to confirm delivery' },
  'order.orderNumber': { ar: 'رقم الطلب', en: 'Order number' },
  'order.total': { ar: 'الإجمالي', en: 'Total' },
  'order.continueShopping': { ar: 'متابعة التسوق', en: 'Continue shopping' },
  'payment.preparing': { ar: 'جاري تجهيز الدفع', en: 'Preparing payment' },
  'payment.redirectingHint': { ar: 'سيتم تحويلك لصفحة الدفع الآمنة خلال لحظات', en: "You'll be redirected to the secure payment page shortly" },
  'payment.failedToPreparePayment': { ar: 'تعذر تجهيز الدفع، برجاء المحاولة مرة أخرى', en: 'Failed to prepare payment — please try again' },
  'payment.failedToPrepareLink': { ar: 'تعذر تجهيز رابط الدفع', en: 'Failed to prepare the payment link' },
  'payment.failedTitle': { ar: 'تعذر تجهيز الدفع', en: 'Payment could not be prepared' },
  'payment.retry': { ar: 'إعادة المحاولة', en: 'Try again' },
  'payment.noDataReceived': { ar: 'لم يتم استلام بيانات الدفع من MyFatoorah', en: 'No payment data was received from MyFatoorah' },
  'payment.notCompleted': { ar: 'لم يتم إتمام الدفع', en: 'Payment was not completed' },
  'payment.verifyFailed': { ar: 'تعذر التحقق من حالة الدفع', en: 'Failed to verify the payment status' },
  'payment.checkingStatus': { ar: 'جاري التحقق من حالة الدفع...', en: 'Checking payment status...' },
  'payment.successTitle': { ar: 'تم الدفع بنجاح', en: 'Payment successful' },
  'payment.successThankYou': { ar: 'شكرا لك{name}، تم تأكيد طلبك وسنبدأ تجهيزه', en: 'Thank you{name}, your order is confirmed and we will start preparing it' },
  'payment.cannotVerifyTitle': { ar: 'تعذر التحقق من الدفع', en: 'Payment could not be verified' },
  'payment.orderSavedHint': { ar: 'طلبك محفوظ، يمكنك المحاولة مرة أخرى في أي وقت', en: 'Your order is saved — you can try again anytime' },
  'payment.retryPayment': { ar: 'إعادة محاولة الدفع', en: 'Retry payment' },
  'order.loadingDetails': { ar: 'جاري تحميل بيانات الطلب...', en: 'Loading order details...' },
  'order.cannotShowDetails': { ar: 'لا يمكن عرض تفاصيل الطلب', en: "Order details can't be shown" },
  'order.cannotShowDetailsHint': {
    ar: 'لكن لا تقلق، اذا تم إنشاء الطلب بنجاح فسيصلك تأكيد قريبا. لأي استفسار برجاء التواصل معنا مع ذكر رقم الطلب.',
    en: "But don't worry — if your order was placed successfully you'll receive a confirmation soon. For any questions, please contact us with your order number.",
  },

  // ---------------------------------------------------------------------
  // Footer / policies
  // ---------------------------------------------------------------------
  'footer.aboutUs': { ar: 'من نحن', en: 'About us' },
  'footer.categories': { ar: 'التصنيفات', en: 'Categories' },
  'footer.storePolicies': { ar: 'سياسات المتجر', en: 'Store policies' },
  'footer.contactUs': { ar: 'تواصل معنا', en: 'Contact us' },
  'footer.paymentPolicy': { ar: 'سياسة الدفع', en: 'Payment policy' },
  'footer.shippingPolicy': { ar: 'سياسة الشحن', en: 'Shipping policy' },
  'footer.returnsPolicy': { ar: 'سياسة الاسترجاع', en: 'Returns policy' },
  'footer.rightsReserved': { ar: 'جميع الحقوق محفوظة', en: 'All rights reserved' },

  // ---------------------------------------------------------------------
  // Not found / errors
  // ---------------------------------------------------------------------
  'error.notFoundTitle': { ar: 'الصفحة غير موجودة', en: 'Page not found' },
  'error.notFoundMessage': {
    ar: 'عذرا، الصفحة التي تبحث عنها غير موجودة',
    en: "Sorry, the page you're looking for doesn't exist",
  },
  'error.backHome': { ar: 'العودة للرئيسية', en: 'Back to home' },

  // Policy pages
  'policy.loadError': { ar: 'حدث خطا اثناء تحميل هذه الصفحة', en: 'Failed to load this page' },
  'policy.noContentYet': { ar: 'لا يوجد محتوى بعد', en: 'No content yet' },
}

export default translations

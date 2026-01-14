# Business Process Workflows (BPMN)

## Student Registration Flow

```mermaid
flowchart TD
    START([Start]) --> VISIT[Visit Studio Website]
    VISIT --> SIGNIN{Has Account?}
    SIGNIN -->|No| SIGNUP[Sign Up with Clerk]
    SIGNIN -->|Yes| LOGIN[Login with Clerk]
    
    SIGNUP --> VERIFY[Email Verification]
    VERIFY --> CREATE[Create User Record]
    CREATE --> MEMBER[Create Tenant Member]
    
    LOGIN --> MEMBER
    MEMBER --> WAIVER{Waiver Required?}
    
    WAIVER -->|Yes| SIGN[Sign Waiver]
    SIGN --> DASH
    WAIVER -->|No| DASH[Student Dashboard]
    DASH --> END([End])
```

## Class Booking Flow

```mermaid
flowchart TD
    START([Start]) --> BROWSE[Browse Schedule]
    BROWSE --> SELECT[Select Class]
    SELECT --> CHECK{Spots Available?}
    
    CHECK -->|No| WAITLIST{Join Waitlist?}
    WAITLIST -->|Yes| ADDWAIT[Add to Waitlist]
    ADDWAIT --> NOTIFY[Await Notification]
    NOTIFY --> CHECK
    WAITLIST -->|No| END1([End])
    
    CHECK -->|Yes| PAYMENT{Payment Required?}
    
    PAYMENT -->|Free or Member| BOOK[Create Booking]
    PAYMENT -->|Paid| PMETHOD{Payment Method}
    
    PMETHOD -->|Credit Card| STRIPE[Stripe Checkout]
    PMETHOD -->|Class Pack| DEDUCT[Deduct Credit]
    PMETHOD -->|Gift Card| REDEEM[Apply Gift Card]
    
    STRIPE --> BOOK
    DEDUCT --> BOOK
    REDEEM --> BOOK
    
    BOOK --> CONFIRM[Send Confirmation]
    CONFIRM --> CALENDAR[Add to Calendar]
    CALENDAR --> END2([End])
```

## Instructor Substitution Flow

```mermaid
flowchart TD
    START([Start]) --> REQUEST[Instructor Requests Sub]
    REQUEST --> NOTIFY[Notify Available Instructors]
    NOTIFY --> WAIT{Response?}
    
    WAIT -->|Accepted| ASSIGN[Assign Substitute]
    ASSIGN --> UPDATE[Update Class Record]
    UPDATE --> STUDENTS[Notify Students]
    STUDENTS --> END1([End])
    
    WAIT -->|Declined All| OWNER[Notify Owner]
    OWNER --> MANUAL{Manual Assignment?}
    MANUAL -->|Yes| ASSIGN
    MANUAL -->|No| CANCEL[Cancel Class]
    CANCEL --> REFUND[Process Refunds]
    REFUND --> STUDENTS2[Notify Students]
    STUDENTS2 --> END2([End])
```

## POS Transaction Flow

```mermaid
flowchart TD
    START([Start]) --> CART[Build Cart]
    CART --> ITEM{Add Item}
    ITEM --> SCAN[Scan/Search Product]
    SCAN --> CART
    
    CART --> CHECKOUT[Checkout]
    CHECKOUT --> APPLY{Discounts?}
    
    APPLY -->|Coupon| VALIDATE[Validate Coupon]
    APPLY -->|Gift Card| BALANCE[Check Balance]
    APPLY -->|None| PAY
    
    VALIDATE --> PAY{Payment Method}
    BALANCE --> PAY
    
    PAY -->|Card| READER[Card Reader]
    PAY -->|Cash| CASH[Cash Drawer]
    READER --> STRIPE[Stripe Terminal]
    
    STRIPE --> COMPLETE[Complete Order]
    CASH --> COMPLETE
    COMPLETE --> RECEIPT[Send Receipt]
    RECEIPT --> INVENTORY[Update Inventory]
    INVENTORY --> END([End])
```

## Membership Subscription Flow

```mermaid
flowchart TD
    START([Start]) --> SELECT[Select Membership Plan]
    SELECT --> STRIPE[Stripe Checkout]
    STRIPE --> WEBHOOK[Webhook: checkout.session.completed]
    
    WEBHOOK --> CREATE[Create Subscription Record]
    CREATE --> ACTIVATE[Activate Member Benefits]
    ACTIVATE --> EMAIL[Welcome Email]
    EMAIL --> END1([End])
    
    subgraph "Recurring Billing"
        RENEW[Invoice Payment Due] --> CHARGE[Stripe Charges Card]
        CHARGE --> SUCCESS{Success?}
        SUCCESS -->|Yes| EXTEND[Extend Period]
        SUCCESS -->|No| RETRY[Retry Payment]
        RETRY --> FAIL{Failed 3x?}
        FAIL -->|Yes| CANCEL[Cancel Subscription]
        FAIL -->|No| RETRY
        CANCEL --> REVOKE[Revoke Benefits]
    end
```

## Video On-Demand Upload Flow

```mermaid
flowchart TD
    START([Start]) --> UPLOAD[Upload Video File]
    UPLOAD --> STREAM[Cloudflare Stream]
    STREAM --> PROCESS[Video Processing]
    PROCESS --> WEBHOOK[Webhook: ready.to.stream]
    
    WEBHOOK --> DATABASE[Create Video Record]
    DATABASE --> METADATA[Extract Metadata]
    METADATA --> ACCESS{Set Access Level}
    
    ACCESS -->|Public| PUB[Everyone Can View]
    ACCESS -->|Members| MEM[Members Only]
    ACCESS -->|Private| PRIV[Admin Only]
    
    PUB --> COLLECTION{Add to Collection?}
    MEM --> COLLECTION
    PRIV --> COLLECTION
    
    COLLECTION -->|Yes| ADD[Add to Collection]
    COLLECTION -->|No| END1
    ADD --> END1([End])
```

## Appointment Booking Flow

```mermaid
flowchart TD
    START([Start]) --> SERVICE[Select Service]
    SERVICE --> DATE[Select Date]
    DATE --> FETCH[Fetch Availability]
    
    FETCH --> SLOTS[Display Time Slots]
    SLOTS --> TIME[Select Time]
    TIME --> CONFIRM[Confirm Details]
    
    CONFIRM --> PAYMENT{Requires Payment?}
    PAYMENT -->|Yes| STRIPE[Stripe Checkout]
    PAYMENT -->|No| BOOK
    
    STRIPE --> BOOK[Create Appointment]
    BOOK --> NOTIFY[Notify Instructor]
    NOTIFY --> EMAIL[Confirmation Email]
    EMAIL --> CALENDAR[Calendar Invite]
    CALENDAR --> END([End])
```

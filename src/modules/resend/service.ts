import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils";
import {
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
  Logger,
} from "@medusajs/framework/types";
import { CreateEmailOptions, Resend } from "resend";
import { orderPlacedEmail } from "./emails/order-placed";
import { resetPasswordEmail } from "./emails/reset-password";
import { shippingUpdateEmail } from "./emails/shipping-update";
import { orderSellerNotificationEmail } from "./emails/order-seller-notification";

enum Templates {
  ORDER_PLACED = "order-placed",
  RESET_PASSWORD = "reset-password",
  SHIPPING_UPDATE = "shipping-update",
  SELLER_NOTIFICATION = "order-seller-notification",
}

const templates: { [key in Templates]?: (props: unknown) => React.ReactNode } =
  {
    [Templates.ORDER_PLACED]: orderPlacedEmail,
    [Templates.RESET_PASSWORD]: resetPasswordEmail,
    [Templates.SHIPPING_UPDATE]: shippingUpdateEmail,
    [Templates.SELLER_NOTIFICATION]: orderSellerNotificationEmail,
  };

type ResendOptions = {
  api_key: string;
  from: string;
  html_templates?: Record<
    string,
    {
      subject?: string;
      content: string;
    }
  >;
};

type InjectedDependencies = {
  logger: Logger;
};

class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "notification-resend";
  private resendClient: Resend;
  private options: ResendOptions;
  private logger: Logger;

  constructor({ logger }: InjectedDependencies, options: ResendOptions) {
    super();
    this.resendClient = new Resend(options.api_key);
    this.options = options;
    this.logger = logger;
  }

  static validateOptions(options: Record<any, any>) {
    if (!options.api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `api_key` is required in the provider's options."
      );
    }
    if (!options.from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `from` is required in the provider's options."
      );
    }
  }

  getTemplate(template: Templates) {
    if (this.options.html_templates?.[template]) {
      return this.options.html_templates[template].content;
    }
    const allowedTemplates = Object.keys(templates);

    if (!allowedTemplates.includes(template)) {
      return null;
    }

    return templates[template];
  }

  getTemplateSubject(template: Templates) {
    if (this.options.html_templates?.[template]?.subject) {
      return this.options.html_templates[template].subject;
    }
    switch (template) {
      case Templates.ORDER_PLACED:
        return "Confirmación de orden";
      case Templates.RESET_PASSWORD:
        return "Restablece tu contraseña";
      case Templates.SHIPPING_UPDATE:
        return "Actualización de envío";
      default:
        return "Nuevo pedido";
    }
  }

  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    const template = this.getTemplate(notification.template as Templates);

    if (!template) {
      this.logger.error(
        `Couldn't find an email template for ${notification.template}. The valid options are ${Object.values(Templates)}`
      );
      return {};
    }

    const emailOptions: Partial<CreateEmailOptions> = {
      from: this.options.from,
      to: [notification.to],
      subject: this.getTemplateSubject(notification.template as Templates),
    };

    if (typeof template === "string") {
      emailOptions.html = template;
    } else {
      emailOptions.react = template(notification.data);
    }

    const { data, error } = await this.resendClient.emails.send(
      emailOptions as CreateEmailOptions
    );

    if (error) {
      this.logger.error(`Failed to send email`, error);
      return {};
    }

    return { id: data?.id };
  }
}

export default ResendNotificationProviderService;

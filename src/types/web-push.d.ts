declare module "web-push" {
  export type PushSubscription = {
    endpoint: string;
    keys?: {
      p256dh: string;
      auth: string;
    };
    [key: string]: unknown;
  };

  const webpush: {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(subscription: PushSubscription, payload?: string | Buffer): Promise<unknown>;
  };

  export default webpush;
}

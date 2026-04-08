abstract class BaseDrawer {
  async prepare(element: any): Promise<void> {
    // no-op by default
  }

  abstract draw(ctx: any, element: any): void;
}

export default BaseDrawer;

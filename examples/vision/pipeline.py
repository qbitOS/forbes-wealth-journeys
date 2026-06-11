"""Vision pipeline entrypoint."""

from pathlib import Path


def run(config: Path) -> None:
    print(f"[vision] pipeline config={config}")


if __name__ == "__main__":
    run(Path("examples/vision/configs/vision.yaml"))

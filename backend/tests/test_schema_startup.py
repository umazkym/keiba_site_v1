import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from database.schema_startup import schema_creation_enabled


class SchemaStartupTest(unittest.TestCase):
    def test_unconfigured_sqlite_is_enabled(self) -> None:
        self.assertTrue(
            schema_creation_enabled(dialect_name="sqlite", configured_value=None)
        )

    def test_unconfigured_postgresql_is_disabled(self) -> None:
        self.assertFalse(
            schema_creation_enabled(dialect_name="postgresql", configured_value=None)
        )

    def test_explicit_false_disables_sqlite(self) -> None:
        self.assertFalse(
            schema_creation_enabled(dialect_name="sqlite", configured_value="false")
        )

    def test_explicit_true_can_enable_maintenance_environment(self) -> None:
        self.assertTrue(
            schema_creation_enabled(dialect_name="postgresql", configured_value="true")
        )

    def test_invalid_value_fails_closed(self) -> None:
        with self.assertRaises(RuntimeError):
            schema_creation_enabled(
                dialect_name="postgresql",
                configured_value="sometimes",
            )


if __name__ == "__main__":
    unittest.main()

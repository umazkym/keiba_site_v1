"""配布範囲の整理でAPIが欠けず、環境設定がソース出力へ混ざらないことを確認する。"""
import importlib.util
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]


class RepositoryDistributionTest(unittest.TestCase):
    def test_relocated_maintenance_tools_import_from_another_directory(self):
        # DB保守を実行せず、移動後のimportと起動ディレクトリの独立性を確認する。
        environment = {**os.environ, 'DATABASE_URL': 'sqlite:///:memory:', 'PYTHONUTF8': '1', 'PYTHON_DOTENV_DISABLED': '1'}
        environment.pop('PYTHONPATH', None)
        program = (
            "import importlib.util, sys; "
            "spec=importlib.util.spec_from_file_location('maintenance_under_test', sys.argv[1]); "
            "module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module); "
            "assert callable(getattr(module, sys.argv[2]))"
        )
        with tempfile.TemporaryDirectory() as directory:
            for filename, entrypoint in [('generate_predictions.py', 'generate_predictions_for_date'),
                                         ('recalculate_advantages.py', 'main'),
                                         ('db_health_checker.py', 'check_database_health')]:
                with self.subTest(filename=filename):
                    result = subprocess.run(
                        [sys.executable, '-c', program, str(ROOT / 'backend/scripts/maintenance' / filename), entrypoint],
                        cwd=directory, env=environment, capture_output=True, text=True, encoding='utf-8', timeout=30,
                    )
                    self.assertEqual(result.returncode, 0, result.stderr)

    def test_api_starts_with_only_docker_copy_sources(self):
        backend = ROOT / 'backend'
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory)
            for line in (backend / 'Dockerfile.api').read_text(encoding='utf-8').splitlines():
                if not line.startswith('COPY '):
                    continue
                source, target = shlex.split(line)[1:]
                self.assertNotEqual(source, '.')
                if (backend / source).is_dir():
                    shutil.copytree(backend / source, destination / target, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
                else:
                    shutil.copy2(backend / source, destination / target)
            environment = {**os.environ, 'DATABASE_URL': 'sqlite:///:memory:', 'PYTHONPATH': str(destination), 'PYTHONUTF8': '1', 'PYTHON_DOTENV_DISABLED': '1'}
            result = subprocess.run(
                [sys.executable, '-c', "from fastapi.testclient import TestClient; import main; c=TestClient(main.app); assert c.get('/').status_code == 200; schema=c.get('/openapi.json'); assert schema.status_code == 200; paths=schema.json()['paths']; assert any(p.startswith('/api/v1/predictions') for p in paths); assert any(p.startswith('/api/v1/data') for p in paths)"],
                cwd=destination, env=environment, capture_output=True, text=True, encoding='utf-8', timeout=30,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertFalse((destination / 'fonts').exists())
            self.assertFalse((destination / 'scripts').exists())

    def test_source_export_excludes_environment_files_and_archives(self):
        spec = importlib.util.spec_from_file_location('source_export_under_test', ROOT / 'scripts/maintenance/export_source.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for filename in ['main.py', '.env', '.env.local', '.env.credentials.json', '.env.example', 'archive/old.py', '.runtime/helper.py', '.local/exports/private.json']:
                target = root / filename
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text('確認用', encoding='utf-8')
            actual = {Path(p).relative_to(root).as_posix() for p in module.get_all_source_files(str(root))}
            self.assertEqual(actual, {'main.py', '.env.example'})

from tasks.pipeline import Pipeline
import tasks.icews
import tasks.ucdp

class DatasetCollectorPipeline(Pipeline):
    def requires(self):
        dependencies =  [
            tasks.ucdp.ged.DatabaseWriter(pipeline = self),
            tasks.icews.DatabaseWriter(pipeline = self)
        ]
        return dependencies

    def run(self):
        pass
